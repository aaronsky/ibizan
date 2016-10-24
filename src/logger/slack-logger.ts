
import { ConsoleLogger } from './console-logger';
import { STRINGS } from '../shared/constants';
const strings = STRINGS.logger;
import { typeIsArray, Controller } from '../shared/common';
const ICON_URL = process.env.ICON_URL || false;

let controller: Controller;

export namespace SlackLogger {
    export function setController(robot: Controller) {
        controller = robot;
    }
    export function initRTM() {
      if (controller && robot.adapter && robot.adapter.client && robot.adapter.client.rtm) {
        return robot.adapter.client.rtm;
      } else {
        ConsoleLogger.warn('Unable to initialize Slack RTM client');
        return false;
      }
    }
    export function initWeb() {
      if (robot && robot.adapter && robot.adapter.client && robot.adapter.client.web) {
        return robot.adapter.client.web;
      } else {
        ConsoleLogger.warn('Unable to initialize Slack web client');
        return false;
      }
    }
    export function getSlackDM(username: string) {
      const rtm = initRTM();
      const web = initWeb();

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
            ConsoleLogger.error(`Unable to open DM with ${username}`);
          }
        })
        .catch((err) => {
          ConsoleLogger.error(`Error opening DM: ${err}`);
        });
      }
    }
    export function getChannelName(channelName: string) {
      const rtm = initRTM();
      const channel = rtm.dataStore.getChannelGroupOrDMById(channelName)
      return channel.name;
    }
    export function logToChannel(msg: string, channel: string, attachment?: any, isUser?: boolean) {
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
            room = getSlackDM(channel);
          }
          robot.send({ room }, message);
        } else {
          ConsoleLogger.error(`No robot available to send message: ${msg}`);
        }
      }
    }
    export function errorToSlack(msg: string, error?: any) {
      const rtm = initRTM();
      if (msg) {
        if (rtm && rtm.dataStore && rtm.dataStore.getChannelOrGroupByName) {
          const diagnosticsRoom = rtm.dataStore.getChannelOrGroupByName('ibizan-diagnostics');
          const room = diagnosticsRoom.id;
          robot.send({ room }, `(${new Date()}) ERROR: ${msg}\n${error || ''}`);
        } else {
          ConsoleLogger.error(msg, error);
        }
      } else {
        ConsoleLogger.error('errorToSlack called with no msg');
      }
    }
    export function addReaction(reaction: string, message: any, attempt = 0) {
      const web = initWeb();
      if (attempt > 0 && attempt <= 2) {
        ConsoleLogger.debug(`Retrying adding ${reaction}, attempt ${attempt}...`);
      }
      if (attempt >= 3) {
        ConsoleLogger.error(`Failed to add ${reaction} to ${message} after ${attempt} attempts`);
        logToChannel(strings.failedreaction, message.user.name);
      } else if (message && web) {
        const params = {
          channel: message.room,
          timestamp: message.id
        };
        setTimeout(() => {
          web.reactions.add(reaction, params)
          .then((response) => {
            if (attempt >= 1) {
              ConsoleLogger.debug(`Added ${reaction} to ${message} after ${attempt} attempts`);
            }
          })
          .catch((err) => {
            attempt += 1;
            addReaction(reaction, message, attempt);
          });
        }, 1000 * attempt);
      } else {
        ConsoleLogger.error('Slack web client unavailable');
      }
    }
    export function removeReaction(reaction: string, message: any, attempt: number = 0) {
      const web = initWeb();

      if (attempt > 0 && attempt <= 2) {
        ConsoleLogger.debug(`Retrying removal of ${reaction}, attempt ${attempt}...`);
      }
      if (attempt >= 3) {
        ConsoleLogger.error(`Failed to remove ${reaction} from ${message} after ${attempt} attempts`);
        logToChannel(strings.failedreaction, message.user.name);
      } else if (message && web) {
        const params = {
          channel: message.room,
          timestamp: message.id
        };
        setTimeout(() => {
          web.reactions.remove(reaction, params)
          .then((response) => {
              if (attempt >= 1) {
                ConsoleLogger.debug(`Removed ${reaction} from ${message} after ${attempt} attempts`);
              }
          })
          .catch((err) => {
              attempt += 1;
              removeReaction(reaction, message, attempt);
          });
        }, 1000 * attempt);
      } else {
        ConsoleLogger.error('Slack web client unavailable');
      }
    }
}