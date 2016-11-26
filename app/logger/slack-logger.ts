
import { ConsoleLogger as Console } from './console-logger';
import { STRINGS } from '../shared/constants';
const strings = STRINGS.logger;
import { typeIsArray } from '../shared/common';
const ICON_URL = process.env.ICON_URL || false;

export namespace SlackLogger {
  let controller: botkit.Controller;
  let bot: botkit.Bot;

  export function setController(control: botkit.Controller) {
    controller = control;
  }
  export function setBot(bot: botkit.Bot) {
    bot = bot;
  }

  export async function log(text: string, channel: string, attachment?: string | { text: string, fallback: string }[], isUser?: boolean) {
    if (!text) {
      Console.error(`No robot available to send message: ${text}`);
      return
    }
    if (!bot) {
      return;
    }
    const message: any = {
      text,
      channel: '',
      parse: 'full',
      username: 'ibizan',
      icon_url: ICON_URL || undefined,
      icon_emoji: ICON_URL ? undefined : ':dog2:',
      attachments: null
    };

    if (attachment) {
      if (typeof attachment === 'string') {
        message.attachments = {
          text: attachment,
          fallback: attachment.replace(/\W/g, '')
        };
      } else {
        message.attachments = attachment;
      }
    }

    if (isUser) {
      openDM(channel, (err, room) => {
        message.channel = channel;
        bot.say(message);
      });
    } else {
      message.channel = channel;
      bot.say(message);
    }
  }

  export function error(text: string, error?: any) {
    if (!text) {
      Console.error('SlackLogger#error called with no message');
      return;
    }
    controller.storage.channels.get('ibizan-diagnostics', (err, data) => {
      if (err) {
        Console.error(err);
        return;
      }
      const message = {
        text: `(${new Date()}) ERROR: ${text}\n${error || ''}`,
        channel: data.id
      } as botkit.Message;
      bot.say(message);
    });
  }

  export function openDM(id: string, onOpenIm: (err: string | Error, channel?: string) => void) {
    bot.api.im.open({ user: id }, (err, response) => {
      if (err) {
        Console.error('Error opening DM', err);
        onOpenIm(err);
        return;
      } else if (!response || !response.ok || !response.channel) {
        Console.error(`Unable to open DM with ${id}`);
        onOpenIm(null);
        return;
      }
      onOpenIm(null, response.channel.id);
    });
  }

  export function addReaction(reaction: string, message: botkit.Message, attempt: number = 0) {
    if (attempt > 0 && attempt <= 2) {
      Console.debug(`Retrying adding ${reaction}, attempt ${attempt}...`);
    }
    if (attempt >= 3) {
      Console.error(`Failed to add ${reaction} to ${message} after ${attempt} attempts`);
      log(strings.failedreaction, message.user_obj.name);
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
              Console.debug(`Added ${reaction} to ${message} after ${attempt} attempts`);
            }
          }
        });
      }, 1000 * attempt);
    } else {
      Console.error('Slack web client unavailable');
    }
  }

  export function removeReaction(reaction: string, message: botkit.Message, attempt: number = 0) {
    if (attempt > 0 && attempt <= 2) {
      Console.debug(`Retrying removal of ${reaction}, attempt ${attempt}...`);
    }
    if (attempt >= 3) {
      Console.error(`Failed to remove ${reaction} from ${message} after ${attempt} attempts`);
      log(strings.failedreaction, message.user_obj.name);
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
              Console.debug(`Removed ${reaction} from ${message} after ${attempt} attempts`);
            }
          }
        });
      }, 1000 * attempt);
    } else {
      Console.error('Slack web client unavailable');
    }
  }
}