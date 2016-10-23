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

import moment from 'moment';

import { HEADERS, STRINGS, TIMEZONE } from '../helpers/constants';
const strings = STRINGS.diagnostics;
import logger from '../helpers/logger';
import { Organization as Org } from '../models/organization';
const Organization = Org.get();

export default function (controller) {
  const Logger = logger(controller);

  // respond
  // diagnostics.uptime
  controller.hears('uptime', ['message_received'], (bot, message) => {
    bot.reply(message, `${Organization.name}'s Ibizan has been up since ${Organization.initTime.toDate()} _(${+moment().diff(Organization.initTime, 'minutes', true).toFixed(2)} minutes)_`);
    Logger.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.users, userRequired: true, adminOnly: true
  controller.hears('users', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const response = 'All users:';
    const attachments = [];
    for (let user of Organization.users) {
      attachments.push(user.slackAttachment());
    }
    user.directMessage(response, Logger, attachments);
    Logger.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.userHelp, adminOnly: true
  controller.hears('user$', ['message_received'], (bot, message) => {
    bot.reply(message, strings.userhelp);
    Logger.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.user, userRequired: true, adminOnly: true
  controller.hears('user (.*)', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const u = Organization.getUserBySlackName(message.match[1]);
    let response = `User ${message.match[1]}`;
    if (u) {
      response += ':';
      user.directMessage(response, Logger, [u.slackAttachment()]);
      Logger.addReaction('dog2', message);
    } else {
      response += ' could not be found. Make sure you\'re using their Slack name.';
      user.directMessage(response, Logger);
      Logger.addReaction('x', message);
    }
  });

  // respond
  // id: diagnostics.dailyReport, adminOnly: true
  controller.hears('daily report', ['message_received'], async (bot, message) => {
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
      const reports = await Organization.generateReport(yesterday, today);
      const report = Organization.dailyReport(reports, today, yesterday);
      bot.reply(message, report);
    } catch (err) {
      Logger.errorToSlack('Failed to produce a daily report', err);
    }
    Logger.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.projects, userRequired: true, adminOnly: true
  controller.hears('projects', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    let response = '';
    for (let project of Organization.projects) {
      response += project.description() + '\n\n';
    }
    user.directMessage(response, Logger);
    Logger.addReaction('dog2', message);
  });

  // respond
  // id: diagnostics.calendar, userRequired: true, adminOnly: true
  controller.hears('calendar', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    user.directMessage(Organization.calendar.description(), Logger);
    Logger.addReaction('dog2', message);
  });

  // respond
  // diagnostics.sync
  controller.hears('sync', ['message_received'], async (bot, message) => {
    Logger.addReaction('clock4', message);
    try {
      const status = await Organization.sync();
      bot.say(message, 'Resynced with spreadsheet');
      Logger.removeReaction('clock4', message);
      Logger.addReaction('dog2', message);
    } catch (err) {
      Logger.errorToSlack('Failed to resync', err);
      Logger.removeReaction('clock4', message);
      Logger.addReaction('x', message);
    }
  });

  controller.webserver.post('/diagnostics/sync', async (req, res) => {
    const body = req.body;
    if (!Organization.ready()) {
      res.status(401);
      res.json({
        text: 'Organization is not ready to resync'
      });
    } else {
      const responseUrl = body.response_url || null;
      if (responseUrl) {
        Logger.log('POSTing to ${responseUrl}');
      }
      res.status(200);
      res.json({
        text: 'Beginning to resync...'
      });
      try {
        const status = await Organization.sync();
        const message = 'Resynced with spreadsheet';
        Logger.log(message);
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
        Logger.errorToSlack(message, err);
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
  controller.hears('.*(help|docs|documentation|commands).*', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    user.directMessage(strings.help, Logger);
    Logger.addReaction('dog2', message);
  });
};