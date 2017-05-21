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
import { Slack } from '../logger';
import { buildOptions } from '../middleware/access';

function onBarkHandler(bot: botkit.Bot, message: Message) {
    bot.startTyping(message);
    bot.reply(message, random(message.copy.bark.bark));
}

function onStoryHandler(bot: botkit.Bot, message: Message) {
    bot.startTyping(message);
    bot.reply(message, random(message.copy.bark.story));
}

function onGoodDogHandler(bot: botkit.Bot, message: Message) {
    const msg = {
        text: message.copy.bark.goodboy,
        channel: message.channel
    } as Message;
    bot.say(msg);
}

function onFetchHandler(bot: botkit.Bot, message: Message) {
    const thing = message.match[1];
    if (!thing) {
        const msg = {
            text: message.copy.bark.fetch(0, message.user_obj.name),
            channel: message.channel
        } as Message;
        bot.say(msg);
    } else {
        const msg = {
            text: message.copy.bark.fetch(2, message.user_obj.name, thing),
            channel: message.channel
        } as Message;
        bot.say(msg);
        setTimeout(() => {
            if ((Math.floor(Math.random() * 10) + 1) === 1) {
                const msg = {
                    text: message.copy.bark.fetch(2, message.user_obj.name, thing),
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
                    text: message.copy.bark.fetch(3, message.user_obj.name, thing),
                    channel: message.channel
                } as Message;
                bot.say(msg);
            }
        }, 2000 * (Math.floor(Math.random() * 5) + 1));
    }
}

export default function (controller: botkit.Controller) {
    // bark.bark
    controller.hears('bark',
        EVENTS.hear,
        buildOptions({ id: 'bark.bark' }, controller),
        onBarkHandler);

    //bark.story
    controller.hears('tell me a story',
        EVENTS.respond,
        buildOptions({ id: 'bark.story' }, controller),
        onStoryHandler);

    // bark.goodboy
    controller.hears('good (dog|boy|pup|puppy|ibizan|ibi)',
        EVENTS.hear,
        buildOptions({ id: 'bark.goodboy' }, controller),
        onGoodDogHandler);

    // bark.fetch
    controller.hears('fetch\s*(.*)?$',
        EVENTS.respond,
        buildOptions({ id: 'bark.fetch' }, controller),
        onFetchHandler);

    return controller;
};