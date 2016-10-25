
import { ConsoleLogger } from './console-logger';
import { STRINGS } from '../shared/constants';
const strings = STRINGS.logger;
import { typeIsArray, Bot, Controller } from '../shared/common';
const ICON_URL = process.env.ICON_URL || false;

export namespace SlackLogger {
  let controller: Controller;
  let bot: Bot;

  export function setController(control: Controller) {
    controller = control;
  }
  export function setBot(bot: Bot) {
    bot = bot;
  }
  export function getSlackDM(username: string, resolve: (id: string) => void) {
    bot.storage.channels.get(username, (err, dm) => {
      if (dm) {
        resolve(dm.id);
      } else {
        bot.storage.users.get(username, (err, user) => {
          bot.api.im.open({ user: user.id }, (err, response) => {
            if (err) {
              ConsoleLogger.error(`Error opening DM: ${err}`);
            } else {
              if (response && response.channel) {
                resolve(response.channel.id);
              } else {
                ConsoleLogger.error(`Unable to open DM with ${username}`);
              }
            }
          });
        });
      }
    });
  }
  export function getChannelName(channelName: string, resolve: (name: string) => void) {
    bot.storage.channels.get(channelName, (err, channel) => {
      resolve(channel.name);
    });
  }
  export function logToChannel(msg: string, channel: string, attachment?: any, isUser?: boolean) {
    if (msg) {
      if (bot) {
        const message = {
          text: msg,
          channel: null,
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
          getSlackDM(channel, (room) => {
            message.channel = room;
            bot.say(message);
          });
        } else {
          message.channel = room;
          bot.say(message);
        }
      } else {
        ConsoleLogger.error(`No robot available to send message: ${msg}`);
      }
    }
  }
  export function errorToSlack(msg: string, error?: any) {
    if (msg) {
      bot.storage.channels.get('ibizan-diagnostics', (err, channel) => {
        if (err) {
          ConsoleLogger.error(msg, error);
          return;
        }
        bot.say({
          text: `(${new Date()}) ERROR: ${msg}\n${error || ''}`,
          channel: channel.id
        });
      });
    } else {
      ConsoleLogger.error('errorToSlack called with no message');
    }
  }
  export function addReaction(reaction: string, message: any, attempt: number = 0) {
    if (attempt > 0 && attempt <= 2) {
      ConsoleLogger.debug(`Retrying adding ${reaction}, attempt ${attempt}...`);
    }
    if (attempt >= 3) {
      ConsoleLogger.error(`Failed to add ${reaction} to ${message} after ${attempt} attempts`);
      logToChannel(strings.failedreaction, message.user.name);
    } else if (bot && reaction && message) {
      setTimeout(() => {
        bot.api.reactions.add({
          timestamp: message.ts,
          channel: message.channel,
          name: reaction
        }, (err, res) => {
          if (err) {
            attempt += 1;
            addReaction(reaction, message, attempt);
          } else {
            if (attempt >= 1) {
              ConsoleLogger.debug(`Added ${reaction} to ${message} after ${attempt} attempts`);
            }
          }
        });
      }, 1000 * attempt);
    } else {
      ConsoleLogger.error('Slack web client unavailable');
    }
  }
  export function removeReaction(reaction: string, message: any, attempt: number = 0) {
    if (attempt > 0 && attempt <= 2) {
      ConsoleLogger.debug(`Retrying removal of ${reaction}, attempt ${attempt}...`);
    }
    if (attempt >= 3) {
      ConsoleLogger.error(`Failed to remove ${reaction} from ${message} after ${attempt} attempts`);
      logToChannel(strings.failedreaction, message.user.name);
    } else if (bot && reaction && message) {
      setTimeout(() => {
        bot.api.reactions.remove({
          timestamp: message.ts,
          channel: message.channel,
          name: reaction
        }, (err, res) => {
          if (err) {
            attempt += 1;
            removeReaction(reaction, message, attempt);
          } else {
            if (attempt >= 1) {
              ConsoleLogger.debug(`Removed ${reaction} from ${message} after ${attempt} attempts`);
            }
          }
        });
      }, 1000 * attempt);
    } else {
      ConsoleLogger.error('Slack web client unavailable');
    }
  }
}