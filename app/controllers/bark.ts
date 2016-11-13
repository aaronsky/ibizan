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
import { buildOptions } from '../middleware/access';

export default function (controller: botkit.Controller) {
  Logger.Slack.setController(controller);

  // bark.bark
  controller.hears('bark', 
                    ['direct_message', 'direct_mention', 'mention', 'ambient'], 
                   buildOptions.bind(null, { id: 'bark.bark' }, null, controller), 
                   (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(strings.bark));
  });

  //bark.story
  controller.hears('tell me a story', 
                    ['direct_message', 'direct_mention', 'mention'], 
                    buildOptions.bind(null, { id: 'bark.story' }, null, controller), 
                    (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(strings.story));
  });

  // bark.goodboy
  controller.hears('good (dog|boy|pup|puppy|ibizan|ibi)', 
                    ['direct_message', 'direct_mention', 'mention'], 
                    buildOptions.bind(null, { id: 'bark.goodboy' }, null, controller), 
                    (bot, message) => {
    const msg = {
      text: strings.goodboy,
      channel: message.channel
    } as botkit.Message;
    bot.say(msg);
  });

  // bark.fetch
  controller.hears('fetch\s*(.*)?$', 
                   ['message_received'], 
                   buildOptions.bind(null, { id: 'bark.fetch' }, null, controller), 
                   (bot, message) => {
    const thing = message.match[1];
    if (!thing) {
      const msg = {
        text: `_perks up and fidgets impatiently, waiting for @${message.user.name} to \`fetch [thing]\`_`,
        channel: message.channel
      } as botkit.Message;
      bot.say(msg);
    } else {
      const msg = {
        text: `_runs to fetch ${thing}!_`,
        channel: message.channel
      } as botkit.Message;
      bot.say(msg);
      setTimeout(() => {
        if ((Math.floor(Math.random() * 10) + 1) === 1) {
          const msg = {
            text: `_returns to @${message.user.name}, unable to find ${thing}${random(strings.fetchsuffix)}_`,
            channel: message.channel
          } as botkit.Message;
          bot.say(msg);
        } else {
          const match = thing.match(/:(.*?):/g);
          if (match) {
            for (let el of match) {
              Logger.Slack.addReaction(el.replace(/:/g, ''), message);
            }
          }
          const msg = {
            text: `_drops ${thing} at @${message.user.name}'s feet${random(strings.fetchsuffix)}_`,
            channel: message.channel
          } as botkit.Message;
          bot.say(msg);
        }
      }, 2000 * (Math.floor(Math.random() * 5) + 1));
    }
  });
};