//  Description:
//    Bark with your dog friend
//
//  Commands:
//
//  Author:
//    aaronsky

import * as moment from 'moment';

import { REGEX, STRINGS } from '../shared/constants';
const strings = STRINGS.bark;
import { random } from '../shared/common';
import * as Logger from '../logger';
import { Organization } from '../models/organization';

const org = new Organization();

export default function (controller) {
  Logger.Slack.setController(controller);

  // bark.bark
  controller.hears('bark', ['direct_message','direct_mention','mention','ambient'], (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(strings.bark));
  });

  //bark.story
  controller.hears('tell me a story', ['direct_message','direct_mention','mention'], (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(strings.story));
  });

  // bark.goodboy
  controller.hears('good (dog|boy|pup|puppy|ibizan|ibi)', ['direct_message','direct_mention','mention'], (bot, message) => {
    bot.say({
      text: strings.goodboy,
      channel: message.channel
    });
  });

  // bark.fetch
  controller.hears('fetch\s*(.*)?$', ['message_received'], (bot, message) => {
    const thing = message.match[1];
    if (!thing) {
      bot.say({
        text: `_perks up and fidgets impatiently, waiting for @${message.user.name} to \`fetch [thing]\`_`,
        channel: message.channel
      });
    } else {
      bot.say({
        text: `_runs to fetch ${thing}!_`,
        channel: message.channel
      });
      setTimeout(() => {
        if ((Math.floor(Math.random() * 10) + 1) === 1) {
          bot.say({
            text: `_returns to @${message.user.name}, unable to find ${thing}${random(strings.fetchsuffix)}_`,
            channel: message.channel
          });
        } else {
          const match = thing.match(/:(.*?):/g);
          if (match) {
            for (let el of match) {
              Logger.Slack.addReaction(el.replace(/:/g, ''), message);
            }
          }
          bot.reply({
            text: `_drops ${thing} at @${message.user.name}'s feet${random(strings.fetchsuffix)}_`,
            channel: message.channel
          })
        }
      }, 2000 * (Math.floor(Math.random() * 5) + 1));
    }
  });

  controller.webserver.get('/', (req, res) => {
    res.json({
      name: process.env.ORG_NAME + '\'s Ibizan',
      version: process.env.npm_package_version,
      time: moment().format()
    });
  });
};