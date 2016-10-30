import { NONAME } from 'dns';
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

import { STRINGS, TIMEZONE } from '../shared/constants';
const strings = STRINGS.diagnostics;
import * as Logger from '../logger';
import { Organization } from '../models/organization';

const org = new Organization();

export default function (controller) {
  Logger.Slack.setController(controller);

  // respond
  // diagnostics.uptime
  controller.hears('uptime', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    bot.reply(message, `${org.name}'s Ibizan has been up since ${org.initTime.toDate()} _(${+moment().diff(org.initTime, 'minutes', true).toFixed(2)} minutes)_`);
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.users, userRequired: true, adminOnly: true
  controller.hears('users', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    const user = org.getUserBySlackName(message.user.name);
    const response = 'All users:';
    const attachments = [];
    for (let user of org.users) {
      attachments.push(user.slackAttachment());
    }
    user.directMessage(response, Logger, attachments);
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.userHelp, adminOnly: true
  controller.hears('user$', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    bot.reply(message, strings.userhelp);
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.user, userRequired: true, adminOnly: true
  controller.hears('user (.*)', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    const user = org.getUserBySlackName(message.user.name);
    const u = org.getUserBySlackName(message.match[1]);
    let response = `User ${message.match[1]}`;
    if (u) {
      response += ':';
      user.directMessage(response, Logger, [u.slackAttachment()]);
      Logger.Slack.addReaction('dog2', message);
    } else {
      response += ' could not be found. Make sure you\'re using their Slack name.';
      user.directMessage(response, Logger);
      Logger.Slack.addReaction('x', message);
    }
  });

  // respond
  // id: diagnostics.dailyReport, adminOnly: true
  controller.hears('daily report', ['direct_message', 'direct_mention', 'mention', 'ambient'], async (bot, message) => {
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
      const reports = await org.generateReport(yesterday, today);
      if (typeof reports !== 'number') {
        const report = org.dailyReport(reports, today, yesterday);
        bot.reply(message, report);
      }
    } catch (err) {
      Logger.Slack.errorToSlack('Failed to produce a daily report', err);
    }
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.projects, userRequired: true, adminOnly: true
  controller.hears('projects', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    const user = org.getUserBySlackName(message.user.name);
    let response = '';
    for (let project of org.projects) {
      response += project.description() + '\n\n';
    }
    user.directMessage(response, Logger);
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.calendar, userRequired: true, adminOnly: true
  controller.hears('calendar', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    const user = org.getUserBySlackName(message.user.name);
    user.directMessage(org.calendar.description(), Logger);
    Logger.Slack.addReaction('dog2', message);
  });

  // respond
  // diagnostics.sync
  controller.hears('sync', ['direct_message', 'direct_mention', 'mention', 'ambient'], async (bot, message) => {
    Logger.Slack.addReaction('clock4', message);
    try {
      const status = await org.sync();
      bot.say(message, 'Resynced with spreadsheet');
      Logger.Slack.removeReaction('clock4', message);
      Logger.Slack.addReaction('dog2', message);
    } catch (err) {
      Logger.Slack.errorToSlack('Failed to resync', err);
      Logger.Slack.removeReaction('clock4', message);
      Logger.Slack.addReaction('x', message);
    }
  });

  controller.webserver.post('/diagnostics/sync', async (req, res) => {
    const body = req.body;
    if (!org.ready()) {
      res.status(401);
      res.json({
        text: 'Organization is not ready to resync'
      });
    } else {
      const responseUrl = body.response_url || null;
      if (responseUrl) {
        Logger.Console.log('POSTing to ${responseUrl}');
      }
      res.status(200);
      res.json({
        text: 'Beginning to resync...'
      });
      try {
        const status = await org.sync();
        const message = 'Resynced with spreadsheet';
        Logger.Console.log(message);
        const payload = {
          text: message
        };
        if (responseUrl) {
          controller.http(responseUrl)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload)) /* (err, response, body) ->
              if err
                response.send "Encountered an error :( #{err}"
                return
              if res.statusCode isnt 200
                response.send "Request didn't come back HTTP 200 :("
                return
              Logger.log body
                    */
        }
      } catch (err) {
        const message = 'Failed to resync';
        Logger.Slack.errorToSlack(message, err);
        const payload = {
          text: message
        };
        if (responseUrl) {
          controller.http(responseUrl)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload));
        }
      }
    }
  });

  // respond
  // diagnostics.help
  controller.hears('.*(help|docs|documentation|commands).*', ['direct_message', 'direct_mention', 'mention', 'ambient'], (bot, message) => {
    const user = org.getUserBySlackName(message.user.name);
    user.directMessage(strings.help, Logger);
    Logger.Slack.addReaction('dog2', message);
  });
};