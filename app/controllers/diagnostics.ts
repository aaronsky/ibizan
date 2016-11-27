import { buildOptions } from '../middleware/access';
// Description:
//   Your dog friend makes sure everything's in order
//
// Commands:
//
// Notes:
//
// Author:
//   aaronsky

import * as moment from 'moment';

import { STRINGS, EVENTS, TIMEZONE } from '../shared/constants';
const strings = STRINGS.diagnostics;
import { Console, Slack } from '../logger';
import { Organization } from '../models/organization';

export default function (controller: botkit.Controller) {
  Slack.setController(controller);

  // respond
  // diagnostics.uptime, 
  controller.hears('uptime', 
                   EVENTS.respond,
                   buildOptions({ id: 'diagnostics.uptime' }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    bot.reply(message, `${organization.name}'s Ibizan has been up since ${organization.initTime.toDate()} _(${+moment().diff(organization.initTime, 'minutes', true).toFixed(2)} minutes)_`);
    Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.users, userRequired: true, adminOnly: true
  controller.hears('users',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.users', userRequired: true, adminOnly: true }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    const response = 'All users:';
    const attachments = [];
    for (let user of organization.users) {
      attachments.push(user.slackAttachment());
    }
    user.directMessage(response, attachments);
    Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.userHelp, adminOnly: true
  controller.hears('user$',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.userHelp', adminOnly: true }, controller), 
                   (bot, message) => {
    bot.reply(message, strings.userhelp);
    Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.user, userRequired: true, adminOnly: true
  controller.hears('user (.*)',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.user', userRequired: true, adminOnly: true }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    const u = organization.getUserBySlackName(message.match[1]);
    let response = `User ${message.match[1]}`;
    if (u) {
      response += ':';
      user.directMessage(response, [u.slackAttachment()]);
      Slack.addReaction('dog2', message);
    } else {
      response += ' could not be found. Make sure you\'re using their Slack name.';
      user.directMessage(response);
      Slack.addReaction('x', message);
    }
  });

  // respond
  // id: diagnostics.dailyReport, adminOnly: true
  controller.hears('daily report',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.dailyReport', adminOnly: true }, controller), 
                   async (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const yesterday = moment.tz({
      hour: 0,
      minute: 0,
      second: 0
    }, TIMEZONE).subtract(1, 'days');
    const today = moment.tz({
      hour: 0,
      minute: 0,
      second: 0
    }, TIMEZONE);
    try {
      const reports = await organization.generateReport(yesterday, today);
      if (typeof reports !== 'number') {
        const report = organization.dailyReport(reports, today, yesterday);
        bot.reply(message, report);
      }
    } catch (err) {
      Slack.error('Failed to produce a daily report', err);
    }
    Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.projects, userRequired: true, adminOnly: true
  controller.hears('projects',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.projects', userRequired: true, adminOnly: true }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    let response = '';
    for (let project of organization.projects) {
      response += project.description() + '\n\n';
    }
    user.directMessage(response);
    Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.calendar, userRequired: true, adminOnly: true
  controller.hears('calendar',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.calendar', userRequired: true, adminOnly: true }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    user.directMessage(organization.calendar.description());
    Slack.addReaction('dog2', message);
  });

  // respond
  // diagnostics.sync
  controller.hears('sync',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.sync' }, controller), 
                   async (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    Slack.addReaction('clock4', message);
    try {
      const status = await organization.sync();
      bot.reply(message, 'Resynced with spreadsheet');
      Slack.removeReaction('clock4', message);
      Slack.addReaction('dog2', message);
    } catch (err) {
      Slack.error('Failed to resync', err);
      Slack.removeReaction('clock4', message);
      Slack.addReaction('x', message);
    }
  });

  // respond
  // diagnostics.help
  controller.hears('.*(help|docs|documentation|commands).*',
                   EVENTS.respond, 
                   buildOptions({ id: 'diagnostics.help' }, controller), 
                   (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    user.directMessage(strings.help);
    Slack.addReaction('dog2', message);
  });
};