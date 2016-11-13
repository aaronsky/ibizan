import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');
import * as express from 'express';
import * as bodyParser from 'body-parser';

import { Team } from './shared/common';
import { Console } from './logger';
import { IbizanConfig, TeamConfig } from './config';
import { applyRoutes } from './routes';
import { Organization } from './models/organization';

import accessMiddleware from './middleware/access';
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
            stats_optout: true,
            webserver: this.setupWebserver()
        }).configureSlackApp({
            clientId: App.config.slack.clientId,
            clientSecret: App.config.slack.clientSecret,
            scopes: App.config.slack.scopes
        });
    }
    start() {
        applyRoutes(this.webserver, this.controller);
        this.webserver.listen(App.config.port, this.onWebserverStart.bind(this));
        this.controller.on('create_bot', this.onCreateBot.bind(this));
        this.controller.on('create_team', this.onCreateTeam.bind(this));
        this.controller.middleware.receive.use(this.onReceiveSetOrganization.bind(this));
        this.controller.storage.teams.all(this.connectTeamsToSlack.bind(this));
        this.loadScripts();
    }
    setupWebserver() {
        this.webserver = express();
        this.webserver.use(bodyParser.json());
        this.webserver.use(bodyParser.urlencoded({ extended: true }));
        this.webserver.use(express.static(path.resolve(__dirname, 'public')));
        return this.webserver;
    }
    onWebserverStart() {
        this.controller.log.info('Ibizan is waking up');
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
                    this.controller.log.error(err.message, err);
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
    onReceiveSetOrganization(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        const token = bot.config.token;
        if (this.bots[token] && this.orgs[token]) {
            message.organization = this.orgs[token];
        }
        next();
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
                        this.controller.log.error('Error connecting bot to Slack:', err);
                    } else {
                        this.trackBot(bot, team);
                    }
                });
            }
        }
    }
    loadScripts() {
        accessMiddleware(this.controller);
        for (let key in scripts) {
            const script = scripts[key];
            this.controller.log(`Loading ${key} script`);
            if (script && typeof script === 'function') {
                script(this.controller);
            } else {
                this.controller.log.error(`Expected ${key} to be a function, instead was a ${typeof script}`);
                throw new Error(`Couldn't load ${key} script`);
            }
        }
    }
};