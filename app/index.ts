import * as fs from 'fs';
import * as path from 'path';
const Botkit = require('botkit');
const FirebaseStorage = require('botkit-storage-firebase');

import { Bot, Controller } from './shared/common';
import { Config } from './config';

export class App {
    config: Config;
    controller: Controller;
    bots: Bot;
    helpEntries: string[];

    constructor(configuration: Config) {
        this.config = configuration;
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

        this.controller.setupWebserver(this.config.port, (err, webserver) => {
            this.controller.createWebhookEndpoints(this.controller.webserver);
            this.controller.createOauthEndpoints(this.controller.webserver, (err, req, res) => {
                if (err) {
                    res.status(500).send('ERROR: ' + err);
                    return;
                }
                res.send('Success!');
            });
        });
        this.controller.on('create_bot', (bot, config) => {
            if (this.bots[bot.config.token]) {
                return;
            }
            bot.startRTM((err) => {
                if (!err) {
                    this.trackBot(bot);
                }
                bot.startPrivateConversation({
                    user: config.createdBy
                }, (err, convo) => {
                    if (err) {
                        console.log(err);
                    } else {
                        convo.say('I am a bot that has just joined your team');
                        convo.say('You must now /invite me to a channel so that I can be of use!');
                    }
                });
            });
        });
        this.controller.storage.teams.all((err, teams) => {
            if (err) {
                throw new Error(err);
            }
            // connect all teams with bots up to slack!
            for (let team of teams) {
                if (team.bot) {
                    this.controller.spawn(team).startRTM((err, bot) => {
                        if (err) {
                            console.log('Error connecting bot to Slack:', err);
                        } else {
                            this.trackBot(bot);
                        }
                    });
                }
            }
        });
        this.loadScripts();
    }
    trackBot(bot: Bot) {
        this.bots[bot.config.token] = bot;
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