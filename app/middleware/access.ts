// Description:
//   Your dog friend guards access to your most prized commands
//
// Commands:
//
// Author:
//   bcoia

import { REGEX, STRINGS } from '../shared/constants';
import { random } from '../shared/common';
const strings = STRINGS.access;
import * as Logger from '../logger';
import { Organization } from '../models/organization';

interface Options {
  id?: string;
  userRequired?: boolean;
  adminOnly?: boolean;
};

export function buildOptions(options: Options, organization: Organization, controller: botkit.Controller, patterns: string[] | RegExp[], message: botkit.Message) {
    message.options = options;
    message.organization = organization;
    return controller.hears_regexp(patterns, message);
  };

export default function (controller: botkit.Controller) {
  Logger.Slack.setController(controller);

  function isAdminUser(username: string, organization: Organization) {
    return organization.config.admins.indexOf(username) !== -1;
  }

  controller.middleware.receive.use((bot: botkit.Bot, message: botkit.Message, next: () => void) => {
    const { id, adminOnly, userRequired } = message.options;

    const username = message.user;
    if (username == 'hubot' || username == 'ibizan') {
      // Ignore myself and messages overheard
      return;
    } else if (id == null) {
      // Ignore unknown commands or catch-alls
      next();
    } else {
      const organization: Organization = message.organization;
      if (!organization.ready()) {
        const msg = {
          text: strings.orgnotready,
          channel: message.channel
        } as botkit.Message;
        bot.say(msg);
        Logger.Slack.addReaction('x', message);
        return;
      } else {
        Logger.Console.log(`Responding to '${message}' (${id}) from ${username}`);
        if (adminOnly) {
          if (!isAdminUser(username, organization)) {
            // Admin command, but user isn't in whitelist
            const msg = {
              text: strings.adminonly,
              channel: message.channel
            } as botkit.Message;
            bot.say(msg);
            Logger.Slack.addReaction('x', message);
            return;
          }
        }
        if (userRequired) {
          const user = organization.getUserBySlackName(username);
          if (!user) {
            // Slack user does not exist in Employee sheet, but user is required
            const msg = {
              text: strings.notanemployee,
              channel: message.channel
            } as botkit.Message;
            bot.say(msg);
            Logger.Slack.addReaction('x', message);
            done();
          }
        }
        next();
      }
    }
  });

  // Catch-all for unrecognized commands
  controller.on('message_received', (bot: botkit.Bot, message: botkit.Message) => {
    if (message &&
      message.text &&
      message.text.length < 30 &&
      (message.text.match(REGEX.ibizan) || message.room && message.room.substring(0, 1) === 'D')) {
      bot.reply(message, `_${random(strings.unknowncommand)} ${random(strings.askforhelp)}_`);
      Logger.Slack.addReaction('question', message);
      bot.finish();
    }
  });
};