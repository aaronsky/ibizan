const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');
import * as express from 'express';
import * as bodyParser from 'body-parser';
const request = require('request');

import { EVENTS, REGEX, STRINGS } from './shared/constants';
const strings = STRINGS.access;
import { Team, Message } from './shared/common';
import { Console, Slack } from './logger';
import { IbizanConfig, TeamConfig } from './config';
import { applyRoutes } from './routes';
import { Organization } from './models/organization';

import { setAccessHandler } from './middleware/access';
import { applyReceiveMiddleware } from './middleware/receive';
import * as scripts from './controllers';

export class App {
    static config: IbizanConfig;
    controller: botkit.Controller;
    bots: { [token: string]: botkit.Bot };
    orgs: { [token: string]: Organization };
    helpEntries: string[];
    webserver: express.Application;

    constructor(config: IbizanConfig) {
        App.config = config;
        this.bots = {};
        this.orgs = {};
        const storage = FirebaseStorage({ firebase_uri: App.config.storageUri });
        this.controller = Botkit.slackbot({
            storage,
            logger: Console,
            stats_optout: true
        }).configureSlackApp({
            clientId: App.config.slack.clientId,
            clientSecret: App.config.slack.clientSecret,
            scopes: App.config.slack.scopes
        });
    }
    start() {
        this.controller.setupWebserver(App.config.port, (err: Error, webserver: express.Application) => {
            this.webserver = webserver;
            applyRoutes(this.webserver, this.controller);
            this.webserver.post('/diagnostics/sync', this.onDiagnosticsSyncRoute.bind(this));

            this.controller.on('create_bot', this.onCreateBot.bind(this));
            this.controller.on('create_team', this.onCreateTeam.bind(this));
            this.controller.on(EVENTS.shouldHound, this.onIbizanEventPassOrganization.bind(this));
            this.controller.on(EVENTS.resetHound, this.onIbizanEventPassOrganization.bind(this));
            this.controller.on(EVENTS.dailyReport, this.onIbizanEventPassOrganization.bind(this));
            this.controller.on(EVENTS.payrollReport, this.onIbizanEventPassOrganization.bind(this));
            this.controller.on(EVENTS.payrollWarning, this.onIbizanEventPassOrganization.bind(this));

            applyReceiveMiddleware(this.controller);
            this.controller.middleware.receive.use(this.onReceiveSetOrganization.bind(this))
                .use(this.onReceiveSetAccessHandler.bind(this));
            this.controller.storage.teams.all(this.connectTeamsToSlack.bind(this));

            this.loadScripts();
        });
    }
    onCreateBot(bot: botkit.Bot, team: Team) {
        if (this.bots[bot.config.token]) {
            return;
        }
        bot.startRTM((err) => {
            if (!err) {
                this.trackBot(bot, team);
            }
            const message = { user: team.createdBy } as Message;
            bot.startPrivateConversation(message, (err, convo) => {
                if (err) {
                    Console.error(err.message, err);
                } else {
                    convo.say('I am a bot that has just joined your team');
                    convo.say('You must now /invite me to a channel so that I can be of use!');
                }
            });
        });
    }
    onCreateTeam(bot: botkit.Bot, team: Team) {
        this.controller.saveTeam(team);
    }
    onIbizanEventPassOrganization(next: (organization: Organization) => void) {
        Object.keys(this.bots).forEach(token => {
            const bot = this.bots[token];
            const organization = this.getOrganization(bot);
            next(organization);
        });
    }
    trackBot(bot: botkit.Bot, team: Team) {
        this.bots[bot.config.token] = bot;
        if (!team.config) {
            // HACK: THIS IS BAD
            team.config = {
                name: team.name,
                admins: [],
                google: {
                    sheetId: '1owlFh2wlnerIPDSLziDUl4jECZC4pYJ0gk3IQ71OLRI'
                }
            };
            this.controller.saveTeam(team);
        }
        this.orgs[bot.config.token] = new Organization(team.config);
    }
    private getOrganization(bot: botkit.Bot) {
        const token = bot.config.token;
        if (token && this.bots[token] && this.orgs[token]) {
            return this.orgs[token];
        }
        return null;
    }
    onReceiveSetOrganization(bot: botkit.Bot, message: Message, next: () => void) {
        const org = this.getOrganization(bot);
        if (org) {
            message.organization = org;
        }
        next();
    }
    onReceiveSetAccessHandler(bot: botkit.Bot, message: Message, next: () => void) {
        setAccessHandler(this.onReceiveCheckAccessHandler.bind(this, bot));
        next();
    }
    onReceiveCheckAccessHandler(bot: botkit.Bot, message: Message): boolean {
        const { user_obj, options } = message;
        const { id, userRequired, adminOnly } = options;

        if (!id) {
            // Ignore unknown commands or catch-alls
            return true;
        }

        if (user_obj && user_obj.name === 'ibizan') {
            // Ignore self
            return false;
        }

        const organization: Organization = this.getOrganization(bot);
        if (!organization.ready()) {
            const msg = {
                text: strings.orgnotready,
                channel: message.channel
            } as Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        }

        Console.info(`Responding to '${message.text}' (${id}) from ${user_obj.name} in ${organization.name}`);
        const orgUser = organization.getUserBySlackName(user_obj.name);
        if (orgUser) {
            orgUser.slackId = message.user;
        }

        if (adminOnly && !user_obj.is_admin) {
            // Admin command, but user isn't in whitelist
            const msg = {
                text: strings.adminonly,
                channel: message.channel
            } as Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        } else if (userRequired) {
            if (!orgUser) {
                // Slack user does not exist in Employee sheet, but user is required
                const msg = {
                    text: strings.notanemployee,
                    channel: message.channel
                } as Message;
                bot.say(msg);
                Slack.addReaction('x', message);
                return false;
            }
        }
        return true;
    }
    async onDiagnosticsSyncRoute(req: express.Request, res: express.Response) {
        const body = req.body;
        const bot = this.bots[body.token];
        const organization = this.getOrganization(bot);
        if (!organization.ready()) {
            res.status(401);
            res.json({
                text: 'Organization is not ready to resync'
            });
        } else {
            const responseUrl = body.response_url || null;
            if (responseUrl) {
                Console.log(`POSTing to ${responseUrl}`);
            }
            res.status(200);
            res.json({
                text: 'Beginning to resync...'
            });
            try {
                const status = await organization.sync();
                const message = 'Resynced with spreadsheet';
                Console.log(message);
                if (responseUrl) {
                    request({
                        url: responseUrl,
                        method: 'POST',
                        json: true,
                        body: {
                            text: message
                        }
                    }, (err: Error, response: any, body: any) => {
                        if (err) {
                            Console.error('Encountered an error :(', err);
                            return;
                        } else if (res.statusCode !== 200) {
                            Console.error('Request didn\'t come back HTTP 200 :(');
                            return;
                        }
                        Console.log(body);
                    });
                }
            } catch (err) {
                const message = 'Failed to resync';
                Slack.error(message, err);
                if (responseUrl) {
                    request({
                        url: responseUrl,
                        method: 'POST',
                        json: true,
                        body: {
                            text: message
                        }
                    });
                }
            }
        }
    }
    connectTeamsToSlack(err, teams: Team[]) {
        if (err) {
            throw new Error(err);
        }
        // connect all teams with bots up to slack!
        teams.forEach(team => {
            team.config.retry = true;
            if (team.bot) {
                this.controller.spawn(team).startRTM((err, bot, res) => {
                    if (err) {
                        Console.error('Error connecting bot to Slack:', err);
                    } else {
                        this.trackBot(bot, team);
                    }
                });
            }
        });
    }
    loadScripts() {
        Object.keys(scripts).forEach(key => {
            const script = scripts[key];
            Console.info(`Loading ${key} script`);
            if (script && typeof script === 'function') {
                script.call(null, this.controller);
            } else {
                Console.error(`Expected ${key} to be a function, instead was a ${typeof script}`);
                throw new Error(`Couldn't load ${key} script`);
            }
        });
    }
};