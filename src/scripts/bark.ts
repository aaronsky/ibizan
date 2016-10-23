//  Description:
//    Bark with your dog friend
//
//  Commands:
//
//  Author:
//    aaronsky

import { REGEX, STRINGS } from '../helpers/constants';
import logger from '../helpers/logger';
const strings = STRINGS.bark;
import * as moment from 'moment';
import { Organization as Org } from '../models/organization';
const Organization = Org.get();

export default function (controller) {
  const Logger = logger(controller);

  // bark.bark
  controller.hears('bark', ['message_received'], (bot, message) => {
    bot.say({
      text: bot.random(strings.bark),
      channel: message.channel
    });
  });

  //bark.story
  controller.hears('tell me a story', ['message_received'], (bot, message) => {
    bot.reply(message, bot.random(strings.story));
  });

  // bark.goodboy
  controller.hears('good (dog|boy|pup|puppy|ibizan|ibi)', ['message_received'], (bot, message) => {
    bot.say({
      text: bot.random(strings.goodboy),
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
            text: `_returns to @${message.user.name}, unable to find ${thing}${bot.random(strings.fetchsuffix)}_`,
            channel: message.channel
          });
        } else {
          const match = thing.match(/:(.*?):/g);
          if (match) {
            for (let el of match) {
              Logger.addReaction(el.replace(/:/g, ''), message);
            }
          }
          bot.say({
            text: `_drops ${thing} at @${message.user.name}'s feet${bot.random(strings.fetchsuffix)}_`,
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