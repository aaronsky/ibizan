//  Description:
//    Bark with your dog friend
//
//  Commands:
//
//  Author:
//    aaronsky

import * as moment from 'moment';

import { REGEX, EVENTS } from '../shared/constants';
import { Message, random } from '../shared/common';
import Copy from '../i18n';
import { Slack } from '../logger';
import { buildOptions } from '../middleware/access';

export default function (controller: botkit.Controller) {
  const copy = Copy.forLocale();
  // bark.bark
  controller.hears('bark', 
                   EVENTS.hear, 
                   buildOptions({ id: 'bark.bark' }, controller), 
                   (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(copy.bark.bark));
  });

  //bark.story
  controller.hears('tell me a story', 
                    EVENTS.respond, 
                    buildOptions({ id: 'bark.story' }, controller), 
                    (bot, message) => {
    bot.startTyping(message);
    bot.reply(message, random(copy.bark.story));
  });

  // bark.goodboy
  controller.hears('good (dog|boy|pup|puppy|ibizan|ibi)', 
                    EVENTS.hear, 
                    buildOptions({ id: 'bark.goodboy' }, controller), 
                    (bot, message) => {
    const msg = {
      text: copy.bark.goodboy,
      channel: message.channel
    } as Message;
    bot.say(msg);
  });

  // bark.fetch
  controller.hears('fetch\s*(.*)?$', 
                   EVENTS.respond, 
                   buildOptions({ id: 'bark.fetch' }, controller), 
                   (bot, message: Message) => {
    const thing = message.match[1];
    if (!thing) {
      const msg = {
        text: `_perks up and fidgets impatiently, waiting for @${message.user_obj.name} to \`fetch [thing]\`_`,
        channel: message.channel
      } as Message;
      bot.say(msg);
    } else {
      const msg = {
        text: `_runs to fetch ${thing}!_`,
        channel: message.channel
      } as Message;
      bot.say(msg);
      setTimeout(() => {
        if ((Math.floor(Math.random() * 10) + 1) === 1) {
          const msg = {
            text: `_returns to @${message.user_obj.name}, unable to find ${thing}${random(copy.bark.fetch)}_`,
            channel: message.channel
          } as Message;
          bot.say(msg);
        } else {
          const match = thing.match(/:(.*?):/g);
          if (match) {
            match.forEach(element => {
              Slack.addReaction(element.replace(/:/g, ''), message);
            });
          }
          const msg = {
            text: `_drops ${thing} at @${message.user_obj.name}'s feet${random(copy.bark.fetch)}_`,
            channel: message.channel
          } as Message;
          bot.say(msg);
        }
      }, 2000 * (Math.floor(Math.random() * 5) + 1));
    }
  });
};