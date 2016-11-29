import { buildOptions } from '../middleware/access';
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

import { STRINGS, EVENTS, TIMEZONE } from '../shared/constants';
const strings = STRINGS.hound;
import { Message } from '../shared/common';
import { Console, Slack } from '../logger';
import { Organization } from '../models/organization';

export default function (controller: botkit.Controller) {
  // Generates a random [in/out] hound message
  function houndMessage(mode: 'in' | 'out') {
    let message;
    if (message === 'in') {
      message = strings.punchin[Math.floor(Math.random() * strings.punchin.length)];
    } else if (message === 'out') {
      message = strings.punchout[Math.floor(Math.random() * strings.punchout.length)]
    }
    if ((Math.floor(Math.random() * 6) + 1) === 1) {
      message += strings.annoying;
    }
    return message;
  }

  function hound(slackuser: { id: string; name: string }, channel: { private?: boolean; is_im?: boolean; is_group?: boolean; name: string }, organization: Organization, forceHound: boolean = false, passive: boolean = false) {
    // HACK: CONSTANT
    if (slackuser.name === 'ibizan') {
      Console.debug('Caught myself, don\'t hound the hound.');
      return;
    } else if (!organization.ready()) {
      Console.debug('Don\'t hound, Organization isn\'t ready yet');
      return;
    }
    const user = organization.getUserBySlackName(slackuser.name);
    if (!user) {
      Console.debug(`${slackuser.name} couldn't be found while attempting to hound`);
      return;
    }
    if (user.settings.shouldHound && user.settings.houndFrequency > 0) {
      if (!channel.private) {
        channel.private = !!channel.is_im || !!channel.is_group;
      }
      if (channel.private || organization.exemptChannels.indexOf(channel.name) !== -1) {
        Console.debug(`#${channel.name} is not an appropriate hounding channel`);
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
      const lastPunch = user.lastPunch(['in', 'out', 'vacation', 'sick', 'unpaid']);
      const lastPing = user.settings.lastPing || now;
      const timeSinceStart = +Math.abs(now.diff(start, 'hours', true)).toFixed(2) || 0;
      const timeSinceEnd = +Math.abs(now.diff(end, 'hours', true)).toFixed(2) || 0;
      const timeSinceLastPunch = now.diff(lastPunch.times.slice(-1)[0], 'hours', true) || 0;
      const timeSinceLastMessage = user.settings.lastMessage.time.diff(last.time, 'hours', true) || 0;
      const timeSinceLastPing = +Math.abs(now.diff(lastPing, 'hours', true)) || 0;

      Console.debug(`${user.slackName} - ${user.salary}, now: ${now.format('h:mm A, z')}, isInactive: ${user.isInactive()}, start: ${start.format('h:mm A')}, end: ${end.format('h:mm A')}, timeSinceLastPunch: ${timeSinceLastPunch}, timeSinceLastMessage: ${timeSinceLastMessage}, timeSinceStart: ${timeSinceStart}, timeSinceEnd: ${timeSinceEnd}, timeSinceLastPing: ${timeSinceLastPing}, houndFrequency: ${user.settings.houndFrequency}`);

      if (user.salary && (timeSinceLastPing === 0 || timeSinceLastPing >= user.settings.houndFrequency) && timeSinceLastPunch > 0.25) {
        if (!lastPunch && !user.isInactive() && !passive) {
          Console.debug(`Considering hounding ${user.slackName} because of missing lastPunch during active period`);
          if (now.isAfter(start) && timeSinceStart >= 0.5) {
            user.hound(houndMessage('in'));
          } else if (now.isAfter(end) && timeSinceEnd >= 0.5) {
            user.hound(houndMessage('out'));
          }
        } else if (lastPunch.mode === 'in' && user.isInactive()) {
          Console.debug(`Considering hounding ${user.slackName} because lastPunch is in and it's outside of their active period`);
          if (now.isAfter(end) && timeSinceEnd >= 0.5) {
            user.hound(houndMessage('out'));
          }
        } else if (lastPunch.mode === 'out' && !passive) {
          Console.debug(`Considering hounding ${user.slackName} because lastPunch is out during active period`);
          if (!user.isInactive() && timeSinceStart >= 0.5) {
            user.hound(houndMessage('in'));
          }
        } else if (lastPunch.mode === 'vacation' || lastPunch.mode === 'sick' || lastPunch.mode === 'unpaid') {
          Console.debug(`Considering hounding ${user.slackName} because lastPunch is special`);
          if (lastPunch.times.length > 0 && !now.isBetween(lastPunch.times[0], lastPunch.times[1]) && !passive) {
            user.hound(houndMessage('in'));
          } else if (lastPunch.times.block && !passive) {
            const endOfBlock = moment(lastPunch.date).add(lastPunch.times.block, 'hours');
            if (!now.isBetween(lastPunch.date, endOfBlock)) {
              user.hound(houndMessage('in'));
            }
          }
        } else if (user.salary && timeSinceLastPunch <= 0.25) {
          Console.debug(`${user.slackName} is safe from hounding because they punched ${timeSinceLastPunch.toFixed(2)} hours ago`);
        } else if (!user.salary && (timeSinceLastPing === 0 || timeSinceLastPing >= user.settings.houndFrequency) && timeSinceLastPunch > 0.25) {
          // Ping part-timers when their shift is longer than their houndFrequency
          if (lastPunch && lastPunch.mode === 'in' && timeSinceLastPunch > user.settings.houndFrequency) {
            user.hound(houndMessage('out'));
          }
        } else {
          Console.debug(`${user.slackName} is safe from hounding for another ${user.settings.houndFrequency - +timeSinceLastPing.toFixed(2)} hours`);
        }
      }
    }
  }

  controller.on('user_typing', (bot, message: Message) => {
    controller.storage.channels.get(message.channel, (err, channel) => {
      if (err || !channel) {
        Console.error('No channel found for this user typing action', err);
        return;
      }
      if (!channel.name) {
        channel = {
          private: true,
          name: 'DM'
        };
      }
      //hound(message.user_obj, channel, organization, false);
    });
  });

  controller.on('presence_change', (bot, message: any) => {
    if (message.presence === 'active') {
      controller.storage.users.get(message.user_obj.id, (err, user) => {
        //hound(user, { private: null, name: '' }, organization, false, true);
      });
    }
  });

  // Every five minutes, attempt to hound non-salaried users
  // const autoHoundJob = schedule.scheduleJob('*/5 * * * *', () => {
  //   if (!organization.ready()) {
  //     Console.warn('Don\'t autohound, Organization isn\'t ready yet');
  //     return;
  //   }
  //   for (let user of organization.users) {
  //     hound({ name: user.slack }, { private: null, name: '' }, organization, true, true);
  //   }
  // });

  // Every morning, reset hound status for each user
  // const resetHoundJob = schedule.scheduleJob('0 9 * * 1-5', () => {
  //   if (!organization.ready()) {
  //     Console.warn('Don\'t run scheduled reset, Organization isn\'t ready yet');
  //     return;
  //   }
  //   const count = organization.resetHounding();
  //   const response = `Reset ${count} ${count === 1 ? 'person\'s' : 'peoples\''} hound status for the morning`;
  //   Slack.log(response, 'ibizan-diagnostics');
  // });


  // Check/adjust hounding settings
  // respond
  // hound.hound, userRequired: true
  controller.hears('hound\s*(.*)?$',
                   EVENTS.respond,
                   buildOptions({ id: 'hound.hound', userRequired: true }, controller),
                   (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot, new Error());
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);

      const command = message.match[1]
      if (!command) {
        bot.reply(message, strings.houndhelp);
        Slack.addReaction('dog2', message);
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
          Slack.addReaction('dog2', message);
        } else if (action === 'start' || action === 'on' || action === 'enable') {
          user.settings.fromSettings({
            shouldHound: true,
            shouldResetHound: true,
            houndFrequency: user.settings.houndFrequency > -1 ? user.settings.houndFrequency : organization.houndFrequency
          });
          user.updateRow();
          user.directMessage('Hounding is now *on*.');
          Slack.addReaction('dog2', message);
        } else if (action === 'stop' || action === 'off' || action === 'disable') {
          user.settings.fromSettings({
            shouldHound: false,
            shouldResetHound: false,
            houndFrequency: -1
          });
          user.updateRow();
          user.directMessage('Hounding is now *off*. You will not be hounded until you turn this setting back on.');
          Slack.addReaction('dog2', message);
        } else if (action === 'pause') {
          if (user.settings.houndFrequency > -1 && user.settings.shouldHound) {
            user.settings.fromSettings({
              shouldHound: false,
              shouldResetHound: true
            });
            user.updateRow();
            user.directMessage('Hounding is now *paused*. Hounding will resume tomorrow.');
            Slack.addReaction('dog2', message);
          } else {
            user.directMessage('Hounding is not enabled, so you cannot pause it.');
            Slack.addReaction('x', message);
          }
        } else if (action === 'reset') {
          user.settings.fromSettings({
            shouldHound: true,
            shouldResetHound: false,
            houndFrequency: organization.houndFrequency
          });
          user.updateRow();
          user.directMessage(`Reset your hounding status to organization defaults *(${organization.houndFrequency} hours)*.`);
          Slack.addReaction('dog2', message);
        } else if (action === 'status' || action === 'info') {
          let status = user.settings.shouldHound ? 'on' : 'off';
          status = user.settings.shouldResetHound ? status : 'disabled';
          if (status === 'on') {
            status += `, and is set to ping every *${user.settings.houndFrequency} hours* while active`;
          }
          user.directMessage(`Hounding is ${status}.`);
          Slack.addReaction('dog2', message);
        } else {
          user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
          Slack.addReaction('x', message);
        }
      } else if (scope === 'org') {
        if (!organization.ready()) {
          user.directMessage('Organization is not ready');
          Slack.addReaction('x', message);
          return;
        }
        let match;
        if (match = action.match(/((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours)/i)) {
          const blockStr = match[0].replace('hours', '').replace('hour', '').replace(/\s+$/, '');
          const block = parseFloat(blockStr);
          organization.setHoundFrequency(+block.toFixed(2));
          user.directMessage(`Hounding frequency set to every ${block} hours for ${Organization.name}, time until next hound reset.`);
          Slack.addReaction('dog2', message);
        } else if (action === 'start' || action === 'enable' || action === 'on') {
          organization.shouldHound = true;
          organization.shouldResetHound = true;
          organization.setShouldHound(true);
          //Organization.setHoundFrequency(+block.toFixed(2));
          user.directMessage('Hounding is now *on* for the organization.');
          Slack.addReaction('dog2', message);
        } else if (action === 'stop' || action === 'disable' || action === 'off') {
          organization.shouldHound = false;
          organization.shouldResetHound = false;
          organization.setShouldHound(false);
          user.directMessage('Hounding is now *off* for the organization. Hounding status will not reset until it is reactivated.');
          Slack.addReaction('dog2', message);
        } else if (action === 'pause') {
          organization.shouldHound = false;
          organization.shouldResetHound = true;
          organization.setShouldHound(false);
          user.directMessage('Hounding is now *paused* for the organization. Hounding will resume tomorrow.');
          Slack.addReaction('dog2', message);
        } else if (action === 'reset') {
          organization.resetHounding();
          user.directMessage(`Reset hounding status for all ${Organization.name} employees.`);
          Slack.addReaction('dog2', message);
        } else if (action === 'status' || action === 'info') {
          let status = organization.shouldHound ? 'on' : 'off';
          status = organization.shouldResetHound ? status : 'disabled';
          if (status === 'on') {
            status += `, and is set to ping every ${organization.houndFrequency} hours while active`;
            user.directMessage(`Hounding is ${status}.`);
            Slack.addReaction('dog2', message);
          } else {
            user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
            Slack.addReaction('x', message);
          }
        } else {
          Console.debug(`Hound could not parse ${command}`);
          user.directMessage('I couldn\'t understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`');
          Slack.addReaction('x', message);
        }
      }
    });
};
