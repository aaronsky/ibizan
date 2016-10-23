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

import moment from 'moment';
import schedule from 'node-schedule';

import { HEADERS, STRINGS, TIMEZONE } from '../helpers/constants';
import logger from '../helpers/logger';
import { Organization as Org } from '../models/organization'
const Organization = Org.get();

export default function (controller) {
  const Logger = logger(controller);

  const generateDailyReportJob = schedule.scheduleJob('0 9 * * *', async () => {
    if (!Organization.ready()) {
      Logger.warn('Don\'t make scheduled daily report, Organization isn\'t ready yet');
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
      const reports = await Organization.generateReport(yesterday, today);
      const numberDone = reports.length;
      const report = Organization.dailyReport(reports, today, yesterday);
      Logger.logToChannel(report, 'bizness-time');
      Logger.logToChannel(`Daily report generated for ${numberDone} employees`, 'ibizan-diagnostics'); 
    } catch(err) {
      Logger.errorToSlack('Failed to produce a daily report', err);
    }
  });

  // Ibizan will export a Payroll Report every other Sunday night.
  const generatePayrollReportJob = schedule.scheduleJob('0 20 * * 0', async () => {
    if (!Organization.ready()) {
      Logger.warn('Don\'t make scheduled daily report, Organization isn\'t ready yet.');
      return;
    } else if (!Organization.calendar.isPayWeek()) {
      Logger.warn('Don\'t run scheduled payroll reminder, it isn\'t a pay-week.');
      return;
    }
    const twoWeeksAgo = moment().subtract(2, 'weeks');
    const today = moment();
    try {
      const reports = await Organization.generateReport(twoWeeksAgo, today, true);
      const numberDone = reports.length;
      Logger.logToChannel(`Salary report generated for ${numberDone} employees`, 'ibizan-diagnostics');
    } catch (err) {
      Logger.errorToSlack('Failed to produce a salary report', err);
    }
  });
  
  // { id: 'payroll.payroll', userRequired: true, adminOnly: true }
  controller.hears('payroll\s*(.*)?$', async (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    let dates = message.match[1];
    if (dates) {
      dates = dates.split(' ');
    }
    if (dates && dates[0] && !dates[1]) {
      user.directMessage('You must provide both a start and end date.', Logger);
      Logger.addReaction('x', message);
    } else {
      const start = dates && dates[0] ? moment(dates[0], 'MM/DD/YYYY') : moment().subtract(2, 'weeks');
      const end = dates && dates[1] ? moment(dates[1], 'MM/DD/YYYY') : moment();
      try {
        const reports = await Organization.generateReport(start, end, true);
        const numberDone = reports.length;
        const response = `Payroll has been generated for ${numberDone} employees from ${start.format('dddd, MMMM D, YYYY')} to ${end.format('dddd, MMMM D, YYYY')}`;
        user.directMessage(response, Logger);
        Logger.log(response);
      } catch (err) {
        const response = `Failed to produce a salary report: ${err}`;
        user.directMessage(response, Logger);
        Logger.error(response);
      }
      Logger.addReaction('dog2', message);
    }
  });

  // Users should receive a DM "chime" every other Friday afternoon to
  // inform them that payroll runs on Monday, and that unaccounted-for
  // time will not be paid.
  const reminderJob = schedule.scheduleJob('0 13 * * 5', () => {
    if (!Organization.ready()) {
      Logger.warn('Don\'t make scheduled daily report, Organization isn\'t ready yet.');
      return;
    } else if (!Organization.calendar.isPayWeek()) {
      Logger.warn('Don\'t run scheduled payroll reminder, it isn\'t a pay-week.');
      return;
    }
    for (let user of Organization.users) {
      user.directMessage('As a reminder, payroll will run on Monday. Unrecorded time will not be paid.\nYou can use `period?` to check your hours for this pay period.', Logger);
    }
  });
};