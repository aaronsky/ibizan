// Description:
//   Your dog friend can keep you in line
//
// Commands:
//   ibizan stop ibizan - Disable hounding until the following morning
//   ibizan disable ibizan - See `stop ibizan`
// Notes:
//   Ibizan will DM an employee as soon as they’ve posted in Slack after
//   more than [houndFrequency] hours of inactivity.
//   If the user is logged out, the DM should say:
//     Check in if you’re on the clock~
//   If the user is logged in, the DM should say:
//     Don’t forget to check out~
// Author:
//   aaronsky

import * as moment from 'moment';
const schedule = require('node-schedule');

import { EVENTS, TIMEZONE } from '../shared/constants';
import { Message } from '../shared/common';
import Copy from '../i18n';
import { Slack } from '../logger';
import { buildOptions } from '../middleware/access';
import { Organization } from '../models/organization';

const copy = Copy.forLocale();

function hound(slackuser: { id: string; name: string }, channel: { private?: boolean; is_im?: boolean; is_group?: boolean; name: string }, organization: Organization, forceHound: boolean = false, passive: boolean = false) {
    // HACK: CONSTANT
    if (slackuser.name === 'ibizan') {
        console.debug('Caught myself, don\'t hound the hound.');
        return;
    } else if (!organization.ready()) {
        console.debug('Don\'t hound, Organization isn\'t ready yet');
        return;
    }
    const user = organization.getUserBySlackName(slackuser.name);
    if (!user) {
        console.debug(`${slackuser.name} couldn't be found while attempting to hound`);
        return;
    }
    if (user.settings.shouldHound && user.settings.houndFrequency > 0) {
        if (!channel.private) {
            channel.private = !!channel.is_im || !!channel.is_group;
        }
        if (channel.private || organization.exemptChannels.indexOf(channel.name) !== -1) {
            console.debug(`#${channel.name} is not an appropriate hounding channel`);
            return;
        }
        const now = moment.tz(user.timetable.timezone.name);
        const last = user.settings.lastMessage || {
            time: now,
            channel: channel.name
        };
        user.settings.fromSettings({
            lastMessage: {
                time: now,
                channel: channel.name
            }
        });

        const [start, end] = user.activeHours;
        const lastPunch = user.lastPunch();
        const lastPing = user.settings.lastPing || now;
        const timeSinceStart = +Math.abs(now.diff(start, 'hours', true)).toFixed(2) || 0;
        const timeSinceEnd = +Math.abs(now.diff(end, 'hours', true)).toFixed(2) || 0;
        const timeSinceLastPunch = (lastPunch && now.diff(lastPunch.times.slice(-1)[0], 'hours', true)) || 0;
        const timeSinceLastMessage = user.settings.lastMessage.time.diff(last.time, 'hours', true) || 0;
        const timeSinceLastPing = +Math.abs(now.diff(lastPing, 'hours', true)) || 0;

        console.debug(`${user.slackName} - ${user.salary}, now: ${now.format('h:mm A, z')}, isInactive: ${user.isInactive()}, start: ${start.format('h:mm A')}, end: ${end.format('h:mm A')}, timeSinceLastPunch: ${timeSinceLastPunch}, timeSinceLastMessage: ${timeSinceLastMessage}, timeSinceStart: ${timeSinceStart}, timeSinceEnd: ${timeSinceEnd}, timeSinceLastPing: ${timeSinceLastPing}, houndFrequency: ${user.settings.houndFrequency}`);

        if (user.salary && (timeSinceLastPing === 0 || timeSinceLastPing >= user.settings.houndFrequency) && timeSinceLastPunch > 0.25) {
            if (!lastPunch && !user.isInactive() && !passive) {
                console.debug(`Considering hounding ${user.slackName} because of missing lastPunch during active period`);
                if (now.isAfter(start) && timeSinceStart >= 0.5) {
                    user.hound(copy.hound.punch('in'));
                } else if (now.isAfter(end) && timeSinceEnd >= 0.5) {
                    user.hound(copy.hound.punch('out'));
                }
            } else if (lastPunch.mode === 'in' && user.isInactive()) {
                console.debug(`Considering hounding ${user.slackName} because lastPunch is in and it's outside of their active period`);
                if (now.isAfter(end) && timeSinceEnd >= 0.5) {
                    user.hound(copy.hound.punch('out'));
                }
            } else if (lastPunch.mode === 'out' && !passive) {
                console.debug(`Considering hounding ${user.slackName} because lastPunch is out during active period`);
                if (!user.isInactive() && timeSinceStart >= 0.5) {
                    user.hound(copy.hound.punch('in'));
                }
            } else if (lastPunch.mode === 'vacation' || lastPunch.mode === 'sick' || lastPunch.mode === 'unpaid') {
                console.debug(`Considering hounding ${user.slackName} because lastPunch is special`);
                if (lastPunch.times.length > 0 && !now.isBetween(lastPunch.times[0], lastPunch.times[1]) && !passive) {
                    user.hound(copy.hound.punch('in'));
                } else if (lastPunch.times.block && !passive) {
                    const endOfBlock = moment(lastPunch.date).add(lastPunch.times.block, 'hours');
                    if (!now.isBetween(lastPunch.date, endOfBlock)) {
                        user.hound(copy.hound.punch('in'));
                    }
                }
            } else if (user.salary && timeSinceLastPunch <= 0.25) {
                console.debug(`${user.slackName} is safe from hounding because they punched ${timeSinceLastPunch.toFixed(2)} hours ago`);
            } else if (!user.salary && (timeSinceLastPing === 0 || timeSinceLastPing >= user.settings.houndFrequency) && timeSinceLastPunch > 0.25) {
                // Ping part-timers when their shift is longer than their houndFrequency
                if (lastPunch && lastPunch.mode === 'in' && timeSinceLastPunch > user.settings.houndFrequency) {
                    user.hound(copy.hound.punch('out'));
                }
            } else {
                console.debug(`${user.slackName} is safe from hounding for another ${user.settings.houndFrequency - +timeSinceLastPing.toFixed(2)} hours`);
            }
        }
    }
}

function onScheduledHoundHandler(organization: Organization) {
    if (!organization.ready()) {
        console.warn('Don\'t autohound, Organization isn\'t ready yet');
        return;
    }
    organization.users.forEach(user => hound({ id: user.slackId, name: user.slackName }, { private: null, name: '' }, organization, true, true));
}

function onScheduledResetHoundHandler(organization: Organization) {
    if (!organization.ready()) {
        console.warn('Don\'t run scheduled reset, Organization isn\'t ready yet');
        return;
    }
    const count = organization.resetHounding();
    const response = `Reset ${count} ${count === 1 ? 'person\'s' : 'peoples\''} hound status for the morning`;
    Slack.log(response, 'ibizan-diagnostics');
}

function onSetUserHoundHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);

    const command = message.match[1]
    if (!command) {
        bot.reply(message, copy.hound.houndHelp);
        Slack.reactTo(message, 'dog2');
        return;
    }
    let comps = command.split(' ') || [];
    let scope = comps[0] || 'self';
    if (scope === organization.name) {
        scope = 'org';
    } else if (scope === message.user_obj.name) {
        scope = 'self';
    } else if (scope !== 'self' && scope !== 'org') {
        if (!isNaN(+comps[0]) && (comps[1] === 'hour' || comps[1] === 'hours')) {
            comps = ['self', comps.join(' ')];
        } else if (comps.length > 2) {
            comps = ['self', comps.slice(1).join(' ')];
        } else {
            comps = ['self', comps[0]];
        }
        scope = comps[0];
    }
    const action = comps[1] || 'unknown';

    if (scope === 'self') {
        let match;
        if (match = action.match(/((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours)/i)) {
            const blockStr = match[0].replace('hours', '').replace('hour', '').replace(/\s+$/, '');
            const block = parseFloat(blockStr);
            user.settings.fromSettings({
                shouldHound: true,
                shouldResetHound: true,
                houndFrequency: block
            });
            user.updateRow();
            user.directMessage(`Hounding frequency set to be every ${block} hours during your active timers.`);
            Slack.reactTo(message, 'dog2');
        } else if (action === 'start' || action === 'on' || action === 'enable') {
            user.settings.fromSettings({
                shouldHound: true,
                shouldResetHound: true,
                houndFrequency: user.settings.houndFrequency > -1 ? user.settings.houndFrequency : organization.houndFrequency
            });
            user.updateRow();
            user.directMessage('Hounding is now *on*.');
            Slack.reactTo(message, 'dog2');
        } else if (action === 'stop' || action === 'off' || action === 'disable') {
            user.settings.fromSettings({
                shouldHound: false,
                shouldResetHound: false,
                houndFrequency: -1
            });
            user.updateRow();
            user.directMessage('Hounding is now *off*. You will not be hounded until you turn this setting back on.');
            Slack.reactTo(message, 'dog2');
        } else if (action === 'pause') {
            if (user.settings.houndFrequency > -1 && user.settings.shouldHound) {
                user.settings.fromSettings({
                    shouldHound: false,
                    shouldResetHound: true
                });
                user.updateRow();
                user.directMessage('Hounding is now *paused*. Hounding will resume tomorrow.');
                Slack.reactTo(message, 'dog2');
            } else {
                user.directMessage('Hounding is not enabled, so you cannot pause it.');
                Slack.reactTo(message, 'x');
            }
        } else if (action === 'reset') {
            user.settings.fromSettings({
                shouldHound: true,
                shouldResetHound: false,
                houndFrequency: organization.houndFrequency
            });
            user.updateRow();
            user.directMessage(`Reset your hounding status to organization defaults *(${organization.houndFrequency} hours)*.`);
            Slack.reactTo(message, 'dog2');
        } else if (action === 'status' || action === 'info') {
            let status = user.settings.shouldHound ? 'on' : 'off';
            status = user.settings.shouldResetHound ? status : 'disabled';
            if (status === 'on') {
                status += `, and is set to ping every *${user.settings.houndFrequency} hours* while active`;
            }
            user.directMessage(`Hounding is ${status}.`);
            Slack.reactTo(message, 'dog2');
        } else {
            user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
            Slack.reactTo(message, 'dog2');
        }
    } else if (scope === 'org') {
        if (!organization.ready()) {
            user.directMessage('Organization is not ready');
            Slack.reactTo(message, 'x');
            return;
        }
        let match;
        if (match = action.match(/((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours)/i)) {
            const blockStr = match[0].replace('hours', '').replace('hour', '').replace(/\s+$/, '');
            const block = parseFloat(blockStr);
            organization.setHoundFrequency(+block.toFixed(2));
            user.directMessage(`Hounding frequency set to every ${block} hours for ${Organization.name}, time until next hound reset.`);
            Slack.reactTo(message, 'dog2');
        } else if (action === 'start' || action === 'enable' || action === 'on') {
            organization.shouldHound = true;
            organization.shouldResetHound = true;
            organization.setShouldHound(true);
            //Organization.setHoundFrequency(+block.toFixed(2));
            user.directMessage('Hounding is now *on* for the organization.');
            Slack.reactTo(message, 'dog2');
        } else if (action === 'stop' || action === 'disable' || action === 'off') {
            organization.shouldHound = false;
            organization.shouldResetHound = false;
            organization.setShouldHound(false);
            user.directMessage('Hounding is now *off* for the organization. Hounding status will not reset until it is reactivated.');
            Slack.reactTo(message, 'dog2');
        } else if (action === 'pause') {
            organization.shouldHound = false;
            organization.shouldResetHound = true;
            organization.setShouldHound(false);
            user.directMessage('Hounding is now *paused* for the organization. Hounding will resume tomorrow.');
            Slack.reactTo(message, 'dog2');
        } else if (action === 'reset') {
            organization.resetHounding();
            user.directMessage(`Reset hounding status for all ${Organization.name} employees.`);
            Slack.reactTo(message, 'dog2');
        } else if (action === 'status' || action === 'info') {
            let status = organization.shouldHound ? 'on' : 'off';
            status = organization.shouldResetHound ? status : 'disabled';
            if (status === 'on') {
                status += `, and is set to ping every ${organization.houndFrequency} hours while active`;
                user.directMessage(`Hounding is ${status}.`);
                Slack.reactTo(message, 'dog2');
            } else {
                user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
                Slack.reactTo(message, 'x');
            }
        } else {
            console.debug(`Hound could not parse ${command}`);
            user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
            Slack.reactTo(message, 'x');
        }
    }
}

export default function (controller: botkit.Controller) {
    controller.on('user_typing', (bot, message: Message) => {
        hound(message.user_obj, message.channel_obj, message.organization, false);
    });

    controller.on('presence_change', (bot, message: any) => {
        if (message.presence === 'active') {
            hound(message.user_obj, { private: null, name: '' }, message.organization, false, true);
        }
    });

    // Every five minutes, attempt to hound non-salaried users
    const autoHoundJob = schedule.scheduleJob('*/5 * * * *', () => {
        controller.trigger(EVENTS.shouldHound, [onScheduledHoundHandler]);
    });

    // Every morning, reset hound status for each user
    const resetHoundJob = schedule.scheduleJob('0 9 * * 1-5', () => {
        controller.trigger(EVENTS.resetHound, [onScheduledResetHoundHandler]);
    });

    // Check/adjust hounding settings
    // respond
    // hound.hound, userRequired: true
    controller.hears('hound\s*(.*)?$',
        EVENTS.respond,
        buildOptions({ id: 'hound.hound', userRequired: true }, controller),
        onSetUserHoundHandler);

    return controller;
};
