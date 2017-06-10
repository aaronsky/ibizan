import * as stringReplaceAsync from 'string-replace-async'; 

import { BLACKLISTED_SLACK_MESSAGE_TYPES, REGEX } from '../shared/constants';
import { isDMChannel, Message, random } from '../shared/common';
import Copy from '../i18n';
import { Slack } from '../logger';


function onReceiveMessage(bot: botkit.Bot, message: Message) {
    if (message &&
        message.text &&
        message.text.length < 30 &&
        (message.text.match(REGEX.ibizan) || message.channel && message.channel.substring(0, 1) === 'D')) {
        bot.reply(message, `_${random(message.copy.access.unknownCommand)} ${random(message.copy.access.askForHelp)}_`);
        Slack.reactTo(message, 'question');
        return;
    }
}

function onReceiveUpdateSlackLogger(bot: botkit.Bot, message: Message, next: () => void) {
    Slack.setBot(bot);
    next();
}

function onReceiveSwallowBlacklistedMessageTypes(bot: botkit.Bot, message: Message, next: () => void) {
    if (BLACKLISTED_SLACK_MESSAGE_TYPES.indexOf(message.type) === -1) {
        next();
    }
}

async function scrubLink(match: string, type: string, link: string, label?: string): Promise<string> {
    if (type === '@') {
        if (label) {
            return `@${label}`;
        }
        const user = await Slack.getUser(link);
        if (user) {
            if (user.name === 'ibizan') {
                return match;
            }
            return `@${user.name}`;
        }
    } else if (type === '#') {
        if (label) {
            return `#${label}`;
        }
        const channel = await Slack.getChannel(link);
        if (channel) {
            return `#${channel.name}`;
        }
    } else if (type === '!') {
        if (['channel', 'group', 'everyone', 'here'].indexOf(link) !== -1) {
            return `@${link}`;
        } else if (label) {
            return label;
        }
        return match;
    } else {
        const mutLink = link.replace(/^mailto:/, '');
        if (label && mutLink.indexOf(label)) {
            return `${label} (${mutLink})`;
        }
        return mutLink;
    }
}

async function onReceiveFormatMessage(bot: botkit.Bot, message: Message, next: () => void) {
    if (!message || message && !message.text) {
        next();
        return;
    }
    const regex = /<([@#!])?([^>|]+)(?:\|([^>]+))?>/g;
    const text = (await stringReplaceAsync(message.text, regex, scrubLink))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    console.log('MESSAGE >>>', text);
    message.text = text;
    next();
}

async function onReceiveSetUser(bot: botkit.Bot, message: Message, next: () => void) {
    if (!message.user) {
        next();
        return;
    }
    try {
        const user = await Slack.getUser(message.user);
        message.user_obj = user;
    } catch (err) { }
    next();
}

async function onReceiveSetChannel(bot: botkit.Bot, message: Message, next: () => void) {
    if (!message.channel) {
        next();
        return;
    }
    if (isDMChannel(message.channel)) {
        try {
            const ims = (await Slack.imList())
                .filter(im => im.id === message.channel) || [];
            if (!ims || (ims && ims.length !== 1)) {
                next();
                return;
            }
            const matchingIm = ims[0];
            const user = await Slack.getUser(matchingIm.user);
            message.channel_obj = {
                id: message.channel,
                name: user.name
            };
        } catch (error) { }
        next();
    } else {
        try {
            const channel = await Slack.getChannel(message.channel);
            message.channel_obj = channel;
        } catch (err) { }
        next();
    }
}

function onReceiveSetCopyForLocale(bot: botkit.Bot, message: Message, next: () => void) {
    message.copy = Copy.forLocale();
    next();
}

export function applyReceiveMiddleware(controller: botkit.Controller) {
    controller.on('message_received', onReceiveMessage);

    controller.middleware.receive.use(onReceiveSwallowBlacklistedMessageTypes)
        .use(onReceiveUpdateSlackLogger)
        .use(onReceiveSetUser)
        .use(onReceiveSetChannel)
        .use(onReceiveSetCopyForLocale)
        .use(onReceiveFormatMessage);
}