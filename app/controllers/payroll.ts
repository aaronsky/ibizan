import { buildOptions } from '../middleware/access';
// Description:
//   Your dog friend is running tasks on a schedule
//
// Commands:
//
// Notes:
//   Weeks ‘start’ on Sunday morning.
//
// Author:
//   aaronsky

import * as moment from 'moment';
const schedule = require('node-schedule');

import { STRINGS, EVENTS, TIMEZONE } from '../shared/constants';
import { Console, Slack } from '../logger';
import { Organization } from '../models/organization';

export default function (controller: botkit.Controller) {
  // const generateDailyReportJob = schedule.scheduleJob('0 9 * * *', async () => {
  //   if (!organization.ready()) {
  //     Console.warn(`Don\'t make scheduled daily report, the ${organization.name} organization isn\'t ready yet.`);
  //     return;
  //   }
  //   const yesterday = moment.tz({
  //     hour: 0,
  //     minute: 0,
  //     second: 0
  //   }, TIMEZONE).subtract(1, 'days');
  //   const today = moment.tz({
  //     hour: 0,
  //     minute: 0,
  //     second: 0
  //   }, TIMEZONE);
  //   try {
  //     const reports = await organization.generateReport(yesterday, today);
  //     if (typeof reports === 'number') {
  //       throw new Error(`Daily reporting was cut short. Only completed ${reports}/${organization.users.length} reports`);
  //     }
  //     const numberDone = reports.length;
  //     const report = organization.dailyReport(reports, today, yesterday);
  //     Slack.log(report, 'bizness-time');
  //     Slack.log(`Daily report generated for ${numberDone} employees`, 'ibizan-diagnostics'); 
  //   } catch(err) {
  //     Slack.error('Failed to produce a daily report', err);
  //   }
  // });

  // Ibizan will export a Payroll Report every other Sunday night.
  // const generatePayrollReportJob = schedule.scheduleJob('0 20 * * 0', async () => {
  //   if (!organization.ready()) {
  //     Console.warn(`Don\'t make scheduled daily report, the ${organization.name} organization isn\'t ready yet.`);
  //     return;
  //   } else if (!organization.calendar.isPayWeek()) {
  //     Console.warn('Don\'t run scheduled payroll reminder, it isn\'t a pay-week.');
  //     return;
  //   }
  //   const twoWeeksAgo = moment().subtract(2, 'weeks');
  //   const today = moment();
  //   try {
  //     const reports = await organization.generateReport(twoWeeksAgo, today, true);
  //     if (typeof reports === 'number') {
  //       throw new Error(`Payroll reporting was cut short. Only completed ${reports}/${organization.users.length} reports`);
  //     }
  //     const numberDone = reports.length;
  //     Slack.log(`Salary report generated for ${numberDone} employees`, 'ibizan-diagnostics');
  //   } catch (err) {
  //     Slack.error('Failed to produce a salary report', err);
  //   }
  // });

  // { id: 'payroll.payroll', userRequired: true, adminOnly: true }
  controller.hears('payroll\s*(.*)?$', 
                    EVENTS.respond, 
                    buildOptions({ id: 'payroll.payroll', userRequired: true, adminOnly: true }, controller), 
                    async (bot, message) => {
    const organization: Organization = message.organization;
    if (!organization) {
      Console.error('No Organization was found for the team: ' + bot, new Error());
      return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    let dates = message.match[1] && message.match[1].split(' ');
    if (dates && dates[0] && !dates[1]) {
      user.directMessage('You must provide both a start and end date.');
      Slack.addReaction('x', message);
    } else {
      const start = dates && dates[0] ? moment(dates[0], 'MM/DD/YYYY') : moment().subtract(2, 'weeks');
      const end = dates && dates[1] ? moment(dates[1], 'MM/DD/YYYY') : moment();
      try {
        const reports = await organization.generateReport(start, end, true);
        if (typeof reports === 'number') {
          throw new Error(`Payroll reporting was cut short. Only completed ${reports}/${organization.users.length} reports`);
        }
        const numberDone = reports.length;
        const response = `Payroll has been generated for ${numberDone} employees from ${start.format('dddd, MMMM D, YYYY')} to ${end.format('dddd, MMMM D, YYYY')}`;
        user.directMessage(response);
        Console.info(response);
      } catch (err) {
        const response = `Failed to produce a salary report: ${err}`;
        user.directMessage(response);
        Console.error(response);
      }
      Slack.addReaction('dog2', message);
    }
  });

  // Users should receive a DM "chime" every other Friday afternoon to
  // inform them that payroll runs on Monday, and that unaccounted-for
  // time will not be paid.
  // const reminderJob = schedule.scheduleJob('0 13 * * 5', () => {
  //   if (!organization.ready()) {
  //     Console.warn(`Don\'t make scheduled daily report, the ${organization.name} organization isn\'t ready yet.`);
  //     return;
  //   } else if (!organization.calendar.isPayWeek()) {
  //     Console.warn('Don\'t run scheduled payroll reminder, it isn\'t a pay-week.');
  //     return;
  //   }
  //   for (let user of organization.users) {
  //     user.directMessage('As a reminder, payroll will run on Monday. Unrecorded time will not be paid.\nYou can use `period?` to check your hours for this pay period.');
  //   }
  // });
};