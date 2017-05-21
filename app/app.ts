const Botkit = require('botkit');
const createFirebaseStorage = require('botkit-storage-firebase');
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as moment from 'moment';
const request = require('request');

import { IbizanConfig, TeamConfig } from './config';
import { Slack } from './logger';
import { Organization } from './models/organization';
import { applyRoutes } from './routes';
import { Team, Message } from './shared/common';
import { EVENTS, REGEX } from './shared/constants';

import * as scripts from './controllers';
import { setAccessHandler } from './middleware/access';
import { applyReceiveMiddleware } from './middleware/receive';

export class App {
    static config: IbizanConfig;
    controller: botkit.Controller;
    bots: { [token: string]: botkit.Bot };
    orgs: { [token: string]: Organization };
    webserver: express.Application;

    constructor(config: IbizanConfig) {
        App.config = config;
        this.bots = {};
        this.orgs = {};
        this.controller = Botkit.slackbot({
            storage: createFirebaseStorage({ firebase_uri: App.config.storageUri }),
            logger: console.winston,
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
                    console.error(err.message, err);
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
        team = this.validateConfig(team);
        this.controller.saveTeam(team);
        this.orgs[bot.config.token] = new Organization(team.config);
    }
    validateConfig(team: Team) {
        // if no team config or team config incomplete
        // onboard

        // if (!team.config) {
        //     onboard(team);
        // } else if (team.config) {

        // }
        // if (!team.config || this.teamConfigIsIncomplete(team.config)) {
        //     // HACK: THIS IS BAD
        //     team.config = {
        //         name: team.name,
        //         google: {
        //             sheetId: '1owlFh2wlnerIPDSLziDUl4jECZC4pYJ0gk3IQ71OLRI'
        //         },
        //         payroll: {
        //             referenceDate: moment(),
        //             period: 2
        //         }
        //     };
        // }
        return team;
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

        // Ignore unknown commands or catch-alls
        if (!id) {
            return true;
        }
        // Ignore me, the bot named Ibizan
        if (user_obj && user_obj.name === 'ibizan') {
            return false;
        }

        const organization: Organization = this.getOrganization(bot);
        if (!organization.ready()) {
            const msg = {
                text: message.copy.access.orgNotReady,
                channel: message.channel
            } as Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        }

        console.log(`Responding to '${message.text}' (${id}) from ${user_obj.name} in ${organization.name}`);
        const orgUser = organization.getUserBySlackName(user_obj.name);
        if (orgUser) {
            orgUser.slackId = message.user;
        }

        // Admin command, but the calling user isn't an admin on Slack
        if (adminOnly && !user_obj.is_admin) {
            const msg = {
                text: message.copy.access.adminOnly,
                channel: message.channel
            } as Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        } else if (userRequired) {
            // Slack user does not exist in Employee sheet, but user is required
            if (!orgUser) {
                const msg = {
                    text: message.copy.access.notAnEmployee,
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
                console.log(`POSTing to ${responseUrl}`);
            }
            res.status(200);
            res.json({
                text: 'Beginning to resync...'
            });
            try {
                const status = await organization.sync();
                const message = 'Resynced with spreadsheet';
                console.debug(message);
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
                            console.error('Encountered an error :(', err);
                            return;
                        } else if (res.statusCode !== 200) {
                            console.error('Request didn\'t come back HTTP 200 :(');
                            return;
                        }
                        console.debug(body);
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
                        console.error('Error connecting bot to Slack:', err);
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
            console.log(`Loading ${key} script`);
            if (script && typeof script === 'function') {
                this.controller = script.call(null, this.controller);
            } else {
                console.error(`Expected ${key} to be a function, instead was a ${typeof script}`);
                throw new Error(`Couldn't load ${key} script`);
            }
        });
    }
};