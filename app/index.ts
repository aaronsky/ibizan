import * as fs from 'fs';
import * as path from 'path';
const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');

import { Bot, Controller, Team } from './shared/common';
import * as Logger from './logger';
import { IbizanConfig, TeamConfig } from './config';
import { Organization } from './models/organization';

let organization: Organization;

export class App {
    config: IbizanConfig;
    controller: Controller;
    bots: { [token: string]: Bot };
    orgs: { [token: string]: Organization };
    helpEntries: string[];

    constructor(config: IbizanConfig) {
        this.config = config;
    }
    start() {
        this.controller = Botkit.slackbot({
            storage: FirebaseStorage({
                firebase_uri: this.config.storageUri
            })
        }).configureSlackApp({
            clientId: this.config.slack.clientId,
            clientSecret: this.config.slack.clientSecret,
            scopes: this.config.slack.scopes
        });

        this.controller.setupWebserver(this.config.port, this.onSetupWebserver);
        this.controller.on('create_bot', this.onCreateBot);
        this.controller.on('create_team', this.onCreateTeam);
        this.controller.middleware.receive.use(this.onReceiveSetOrganization);
        this.controller.storage.teams.all(this.connectTeamsToSlack);
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
                    Logger.Console.error(err.message, err);
                } else {
                    convo.say('I am a bot that has just joined your team');
                    convo.say('You must now /invite me to a channel so that I can be of use!');
                }
            });
        });
    }
    onCreateTeam(bot: Bot, team: Team) {
        // create config
        let newConfig: TeamConfig;

        this.controller.storage.teams.save({ 
            id: team.id,
            createdBy: team.createdBy,
            url: team.url,
            name: team.name,
            config: newConfig
        }, (err) => {
            if (err) {

            }
        });
    }
    trackBot(bot: Bot, team: Team) {
        this.bots[bot.config.token] = bot;
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
                        Logger.Console.error('Error connecting bot to Slack:', err);
                    } else {
                        this.trackBot(bot, team);
                    }
                });
            }
        }
    }
    loadScripts() {
        const scriptsDirectory = path.resolve('controllers');
        const scriptFiles = fs.readdirSync(scriptsDirectory).sort();
        for (let file of scriptFiles) {
            const scriptExtension = path.extname(file);
            const scriptPath = path.join(scriptsDirectory, path.basename(file, scriptExtension));
            if (!require.extensions[scriptExtension]) {
                continue;
            }
            try {
                this.controller.log('Loading script:', file);
                const script = require(scriptPath);
                if (typeof script.init === 'function') {
                    script.init(this.controller);
                } else {
                    this.controller.log.error('Expected init to be a function, instead was a ' + typeof script.init);
                }
                if (script.help) {
                    this.helpEntries = this.helpEntries.concat(script.help);
                }
            } catch (err) {
                this.controller.log.error('Couldn\'t load', file, '\n', err);
            }
        }
    }
};