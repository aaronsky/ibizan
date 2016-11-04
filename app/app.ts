import * as fs from 'fs';
import * as path from 'path';
const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');

import { Bot, Controller, Team } from './shared/common';
import { Console } from './logger';
import { IbizanConfig, TeamConfig } from './config';
import { Organization } from './models/organization';

import * as scripts from './controllers';

export class App {
    static config: IbizanConfig;
    controller: Controller;
    bots: { [token: string]: Bot };
    orgs: { [token: string]: Organization };
    helpEntries: string[];

    constructor(config: IbizanConfig) {
        App.config = config;
        this.bots = {};
        this.orgs = {};
    }
    start() {
        this.controller = Botkit.slackbot({
            storage: FirebaseStorage({
                firebase_uri: App.config.storageUri
            }),
            logger: Console,
            stats_optout: true
        }).configureSlackApp({
            clientId: App.config.slack.clientId,
            clientSecret: App.config.slack.clientSecret,
            scopes: App.config.slack.scopes
        });

        this.controller.setupWebserver(App.config.port, this.onSetupWebserver.bind(this));
        this.controller.on('create_bot', this.onCreateBot.bind(this));
        this.controller.on('create_team', this.onCreateTeam.bind(this));
        this.controller.middleware.receive.use(this.onReceiveSetOrganization.bind(this));
        this.controller.storage.teams.all(this.connectTeamsToSlack.bind(this));
        this.loadScripts();
    }
    onSetupWebserver(err: Error, webserver) {
        this.controller.createWebhookEndpoints(this.controller.webserver);
        this.controller.createOauthEndpoints(this.controller.webserver, (err, req, res) => {
            if (err) {
                res.status(500).send('ERROR: ' + err);
                return;
            }
            res.send('Success!');
        });
    }
    onCreateBot(bot: Bot, team: Team) {
        if (this.bots[bot.config.token]) {
            return;
        }
        bot.startRTM((err) => {
            if (!err) {
                this.trackBot(bot, team);
            }
            bot.startPrivateConversation({
                user: team.createdBy
            }, (err, convo) => {
                if (err) {
                    this.controller.log.error(err.message, err);
                } else {
                    convo.say('I am a bot that has just joined your team');
                    convo.say('You must now /invite me to a channel so that I can be of use!');
                }
            });
        });
    }
    onCreateTeam(bot: Bot, team: Team) {
        this.saveTeam(team);;
    }
    saveTeam(team: Team) {
        // create config
        // TODO: This variable being undefined crashes ibizan. The todo is to work on the solution for per-team sheets, or use a hack job in the interim.
        let newConfig: TeamConfig = {
            name: team.name,
            admins: [],
            google: {
                sheetId: '1owlFh2wlnerIPDSLziDUl4jECZC4pYJ0gk3IQ71OLRI'
            }
        };

        // authorize

        this.controller.storage.teams.save({
            id: team.id,
            createdBy: team.createdBy,
            url: team.url,
            name: team.name,
            config: newConfig
        }, (err) => {
            if (err) {
                this.controller.log.error('Error saving team to database: ', err);
            } else {

            }
        });
    }
    trackBot(bot: Bot, team: Team) {
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
            this.saveTeam(team);
        }
        this.orgs[bot.config.token] = new Organization(team.config);
    }
    onReceiveSetOrganization(bot: Bot, message, next) {
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