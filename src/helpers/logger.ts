
import * as chalk from 'chalk';
import { STRINGS } from '../helpers/constants';

const strings = STRINGS.logger;
const TEST = process.env.TEST || false;
const ICON_URL = process.env.ICON_URL || false;

let logLevelEnvString;
if (logLevelEnvString = process.env.LOG_LEVEL) {
  if (typeof logLevelEnvString === 'string') {
    logLevelEnvString = logLevelEnvString.toLowerCase();
    var LOG_LEVEL = logLevelEnvString;
    if (['info', 'warn', 'warning', 'error', 'debug', 'true'].indexOf(LOG_LEVEL) === -1) {
      LOG_LEVEL = 0;
    } else if (LOG_LEVEL === 'debug') {
      LOG_LEVEL = 4;
    } else if (LOG_LEVEL === 'info' || LOG_LEVEL === 'true') {
      LOG_LEVEL = 3;
    } else if (LOG_LEVEL === 'warn' || LOG_LEVEL === 'warning') {
      LOG_LEVEL = 2;
    } else if (LOG_LEVEL === 'error') {
      LOG_LEVEL = 1;
    }
  } else if (typeof logLevelEnvString === 'integer' && logLevelEnvString >= 0 && logLevelEnvString <= 4) {
    LOG_LEVEL = logLevelEnvString;
  } else {
    LOG_LEVEL = 0;
  }
} else {
  LOG_LEVEL = 0;
}

const debugHeader = chalk.bold.green;
const debug = chalk.green;
const logHeader = chalk.bold.blue;
const log = chalk.blue;
const warnHeader = chalk.bold.yellow;
const warn = chalk.yellow;
const errHeader = chalk.bold.red;
const err = chalk.red;
const funHeader = chalk.bold.magenta;
const fun = chalk.magenta;

function typeIsArray(value: any) {
  return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export default function (robot?: any) {
  class Logger {
    constructor() {

    }
    static clean(msg: any) {
      let message = '';

      if (typeof msg === 'string') {
        message = msg
      } else if (typeof msg === 'object' && msg.message) {
        message = msg.message
      }

      let response, match;
      if (match = message.match(/Error: HTTP error (.*) \((?:.*)\) -/)) {
        const errorCode = match[1];
        if (errorCode === '500' || errorCode === '502' || errorCode === '404') {
          response = strings.googleerror;
        }
      } else {
        response = message;
      }
      return response;
    }
    static debug(msg: string) {
      if (msg && LOG_LEVEL >= 4) {
        console.log(debugHeader(`[Ibizan] (${new Date()}) DEBUG: `) + debug(`${msg}`));
      }
    }
    static log(msg: string) {
      if (msg && LOG_LEVEL >= 3) {
        console.log(logHeader(`[Ibizan] (${new Date()}) INFO: `) + log(`${msg}`));
      }
    }
    static warn(msg: string) {
      if (msg && LOG_LEVEL >= 2) {
        console.warn(warnHeader(`[Ibizan] (${new Date()}) WARN: `) + warn(`${msg}`));
      }
    }
    static error(msg: string, error?: any) {
      if (msg && LOG_LEVEL >= 1) {
        console.error(errHeader(`[Ibizan] (${new Date()}) ERROR: `) + err(`${msg}`), error || '');
        if (error && error.stack) {
          console.error(errHeader(`[Ibizan] (${new Date()}) STACK: `) + err(`${error.stack}`));
        }
      }
    }
    static fun(msg: string) {
      if (msg && !TEST) {
        console.log(funHeader(`[Ibizan] (${new Date()}) > `) + fun(`${msg}`));
      }
    }
    static initRTM() {
      if (robot && robot.adapter && robot.adapter.client && robot.adapter.client.rtm) {
        return robot.adapter.client.rtm;
      } else {
        Logger.warn('Unable to initialize Slack RTM client');
        return false;
      }
    }
    static initWeb() {
      if (robot && robot.adapter && robot.adapter.client && robot.adapter.client.web) {
        return robot.adapter.client.web;
      } else {
        Logger.warn('Unable to initialize Slack web client');
        return false;
      }
    }
    static getSlackDM(username: string) {
      const rtm = Logger.initRTM();
      const web = Logger.initWeb();

      const dm = rtm.dataStore.getDMByName(username);
      if (dm) {
        return dm.id;
      } else {
        const user = rtm.dataStore.getUserByName(username);
        web.im.open(user.id)
        .then((response) => {
          if (response && response.channel) {
            return response.channel.id;
          } else {
            Logger.error(`Unable to open DM with ${username}`);
          }
        })
        .catch((err) => {
          Logger.error(`Error opening DM: ${err}`);
        });
      }
    }
    static getChannelName(channelName: string) {
      const rtm = Logger.initRTM();
      const channel = rtm.dataStore.getChannelGroupOrDMById(channelName)
      return channel.name;
    }
    static logToChannel(msg: string, channel: string, attachment?: any, isUser?: boolean) {
      if (msg) {
        if (robot && robot.send) {
          const message = {
            text: msg,
            parse: 'full',
            username: 'ibizan',
            icon_url: ICON_URL || undefined,
            icon_emoji: ICON_URL ? undefined : ':dog2:',
            attachments: null
          };
          if (attachment && typeIsArray(attachment)) {
            message.attachments = attachment;
          } else if (attachment) {
            message.attachments = {
              text: attachment,
              fallback: attachment.replace(/\W/g, ''),
            };
          }
          let room = channel;
          if (isUser) {
            room = Logger.getSlackDM(channel);
          }
          robot.send({ room }, message);
        } else {
          Logger.error(`No robot available to send message: ${msg}`);
        }
      }
    }
    static errorToSlack(msg: string, error?: any) {
      const rtm = Logger.initRTM();
      if (msg) {
        if (rtm && rtm.dataStore && rtm.dataStore.getChannelOrGroupByName) {
          const diagnosticsRoom = rtm.dataStore.getChannelOrGroupByName('ibizan-diagnostics');
          const room = diagnosticsRoom.id;
          robot.send({ room }, `(${new Date()}) ERROR: ${msg}\n${error || ''}`);
        } else {
          Logger.error(msg, error);
        }
      } else {
        Logger.error('errorToSlack called with no msg');
      }
    }
    static addReaction(reaction: string, message: any, attempt = 0) {
      const web = Logger.initWeb();
      if (attempt > 0 && attempt <= 2) {
        Logger.debug(`Retrying adding ${reaction}, attempt ${attempt}...`);
      }
      if (attempt >= 3) {
        Logger.error(`Failed to add ${reaction} to ${message} after ${attempt} attempts`);
        Logger.logToChannel(strings.failedreaction, message.user.name);
      } else if (message && web) {
        const params = {
          channel: message.room,
          timestamp: message.id
        };
        setTimeout(() => {
          web.reactions.add(reaction, params)
          .then((response) => {
            if (attempt >= 1) {
              Logger.debug(`Added ${reaction} to ${message} after ${attempt} attempts`);
            }
          })
          .catch((err) => {
            attempt += 1;
            Logger.addReaction(reaction, message, attempt);
          });
        }, 1000 * attempt);
      } else {
        Logger.error('Slack web client unavailable');
      }
    }
    static removeReaction(reaction: string, message: any, attempt: number = 0) {
      const web = Logger.initWeb();

      if (attempt > 0 && attempt <= 2) {
        Logger.debug(`Retrying removal of ${reaction}, attempt ${attempt}...`);
      }
      if (attempt >= 3) {
        Logger.error(`Failed to remove ${reaction} from ${message} after ${attempt} attempts`);
        Logger.logToChannel(strings.failedreaction, message.user.name);
      } else if (message && web) {
        const params = {
          channel: message.room,
          timestamp: message.id
        };
        setTimeout(() => {
          web.reactions.remove(reaction, params)
          .then((response) => {
              if (attempt >= 1) {
                Logger.debug(`Removed ${reaction} from ${message} after ${attempt} attempts`);
              }
          })
          .catch((err) => {
              attempt += 1;
              Logger.removeReaction(reaction, message, attempt);
          });
        }, 1000 * attempt);
      } else {
        Logger.error('Slack web client unavailable');
      }
    }
  }
  return Logger;
};