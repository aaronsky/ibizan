import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');
import * as express from 'express';
import * as bodyParser from 'body-parser';

import { REGEX, STRINGS } from './shared/constants';
const strings = STRINGS.access;
import { Team, random } from './shared/common';
import { Console, Slack } from './logger';
import { IbizanConfig, TeamConfig } from './config';
import { applyRoutes } from './routes';
import { Organization } from './models/organization';

import { setAccessHandler } from './middleware/access';
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
            this.controller.on('create_bot', this.onCreateBot.bind(this));
            this.controller.on('create_team', this.onCreateTeam.bind(this));
            this.controller.on('message_received', this.onReceiveMessage.bind(this));
            this.controller.middleware.receive.use(this.onReceiveSetOrganization.bind(this));
            this.controller.middleware.receive.use(this.onReceiveSetUser.bind(this));
            this.controller.middleware.receive.use(this.onReceiveSetAccessHandler.bind(this));
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
            const message = { user: team.createdBy } as botkit.Message;
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
    onReceiveMessage(bot: botkit.Bot, message: botkit.Message) {
        if (message &&
            message.text &&
            message.text.length < 30 &&
            (message.text.match(REGEX.ibizan) || message.channel && message.channel.substring(0, 1) === 'D')) {
            bot.reply(message, `_${random(strings.unknowncommand)} ${random(strings.askforhelp)}_`);
            Slack.addReaction('question', message);
            return;
        }
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
    onReceiveSetOrganization(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        const org = this.getOrganization(bot);
        if (org) {
            message.organization = org;
        }
        next();
    }
    onReceiveSetUser(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        if (!message.user) {
            next();
            return;
        }
        bot.api.users.info({ user: message.user }, (err, data) => {
            if (!data.ok) {
                next();
                return;
            }
            const { user } = data;
            message.user = user;
            next();
        });
    }
    onReceiveSetAccessHandler(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        setAccessHandler(this.onReceiveCheckAccessHandler.bind(this, bot));
        next();
    }
    onReceiveCheckAccessHandler(bot: botkit.Bot, message: botkit.Message): boolean {
        const { user, options } = message;
        const { id, userRequired, adminOnly } = options;

        if (!id) {
            // Ignore unknown commands or catch-alls
            return true;
        }

        if (user && user.name === 'ibizan') {
            // Ignore self
            return false;
        }

        const organization: Organization = this.getOrganization(bot);
        if (!organization.ready()) {
            const msg = {
                text: strings.orgnotready,
                channel: message.channel
            } as botkit.Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        }

        Console.info(`Responding to '${message.text}' (${id}) from ${user.name} in ${organization.name}`);

        if (adminOnly && !user.is_admin) {
            // Admin command, but user isn't in whitelist
            const msg = {
                text: strings.adminonly,
                channel: message.channel
            } as botkit.Message;
            bot.say(msg);
            Slack.addReaction('x', message);
            return false;
        } else if (userRequired) {
            const orgUser = organization.getUserBySlackName(user.name);
            if (!orgUser) {
                // Slack user does not exist in Employee sheet, but user is required
                const msg = {
                    text: strings.notanemployee,
                    channel: message.channel
                } as botkit.Message;
                bot.say(msg);
                Slack.addReaction('x', message);
                return false;
            }
        }
        return true;
    }
    connectTeamsToSlack(err, teams: any[]) {
        if (err) {
            throw new Error(err);
        }
        // connect all teams with bots up to slack!
        for (let team of teams) {
            if (team.bot) {
                this.controller.spawn(team).startRTM((err, bot) => {
                    if (err) {
                        Console.error('Error connecting bot to Slack:', err);
                    } else {
                        this.trackBot(bot, team);
                    }
                });
            }
        }
    }
    loadScripts() {
        for (let key in scripts) {
            const script = scripts[key];
            Console.info(`Loading ${key} script`);
            if (script && typeof script === 'function') {
                script.call(null, this.controller);
            } else {
                Console.error(`Expected ${key} to be a function, instead was a ${typeof script}`);
                throw new Error(`Couldn't load ${key} script`);
            }
        }
    }
};