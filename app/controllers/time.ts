// Description:
//   Punch your timesheet from the comfort of Slack
//
// Commands:
//   ibizan in - Punch in at the current time and date
//   ibizan out - Punch out at the current time and date
//   ibizan in #project1 - Punch in at the current time and assigns the current
//                         project to #project1
//   ibizan out #project1 #project2 - Punch out at the current time and splits
//                                    the worked time since last in-punch between
//                                    #project1 and #project2
//   ibizan in 9:15 - Punch in at 9:15am today
//   ibizan out 7pm yesterday - Punch out yesterday at 7pm
//   ibizan in 17:00 #project3 - Punch in at 5pm and assigns the time until next
//                               out-punch to #project3
//   ibizan 1.5 hours - Append 1.5 hours to today's total time
//   ibizan 2 hours yesterday - Append 2 hours on to yesterday's total time
//   ibizan 3.25 hours tuesday #project1 - Append 3.25 hours on to Tuesday's
//                                         total time and assigns it to #project1
//   ibizan vacation today - Flags the user’s entire day as vacation time
//   ibizan sick half-day - Flags half the user’s day as sick time
//   ibizan vacation half-day yesterday - Flags half the user’s previous day
//                                        (4 hours) as vacation time
//   ibizan sick Jul 6-8 - Flags July 6-8 of this year as sick time
//   ibizan vacation 1/28 - 2/4 - Flags January 28th to February 4th of this year
//                                as vacation time.
//
//   ibizan hours - Replies with helpful info for hours? and hours [date]
//   ibizan hours 8/4 - Replies with punches recorded on a given date
//   ibizan hours? - Replies with the user's total time for today, with punches
//   ibizan today? - Replies with the user's total time for today, with punches
//   ibizan week? - Replies with the user's total time for the week, with punches
//   ibizan month? - Replies with the user's total time for the month
//   ibizan year? - Replies with the user's total time for the year
//   ibizan status - Replies with the user's Employee sheet info
//   ibizan time - Replies with the current time in both Ibizan's default
//                 timezone and the user's timezone
//   ibizan timezone - Replies with the user's timezone
//   ibizan timezone america/chicago - Sets the user's timezone
//
// Notes:
//   All dates are formatted in MM/DD notation with no support for overriding
//   year. Ibizan will extrapolate year from your ranges, even if it stretches
//   over multiple years.
//
// Author:
//   aaronsky

import moment from 'moment-timezone';

import { REGEX, HEADERS, STRINGS, TIMEZONE } from '../shared/constants';
const strings = STRINGS.time;
import Logger from '../logger';
import { Organization as Org } from '../models/organization';
const Organization = Org.get();
import Punch from '../models/punch';
import User from '../models/user';

export default function (controller) {
  Logger.Slack.setController(controller);

  function isDM(channel) {
    const channelName = channel.toString();
    return channelName.substring(0, 1) === 'D';
  }

  function isClockChannel(channel) {
    const chan = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(channel);
    return chan.name === Organization.clockChannel;
  }

  function isProjectChannel(channel) {
    const chan = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(channel);
    return (!isClockChannel(channel) && !isDM(channel) && Organization.getProjectByName(chan.name) != null);
  }

  function canPunchHere(channel) {
    return isDM(channel) || isClockChannel(channel) || isProjectChannel(channel);
  }

  function toTimeStr(duration: number) {
    const hours = Math.floor(duration);
    let hoursStr;
    if (hours === 0) {
      hoursStr = '';
    } else if (hours === 1) {
      hoursStr = `${hours} hour`;
    } else {
      hoursStr = `${hours} hours`;
    }
    const minutes = Math.round((duration - hours) * 60);
    let minutesStr;
    if (minutes === 0) {
      minutesStr = '';
    } else if (minutes === 1) {
      minutesStr = `${minutes} minute`;
    } else {
      minutesStr = `${minutes} minutes`;
    }
    return `${hoursStr}${hours > 0 && minutes > 0 ? ', ' : ''}${minutesStr}`;
  }

  // Parse a textual punch and produce a new Punch object
  function parse(bot, message, mode) {
    mode = mode.toLowerCase();
    const user = Organization.getUserBySlackName(message.user.name);
    Logger.Console.log(`Parsing '${message.text} for @${user.slack}.`);
    if (canPunchHere(message.room)) {
      Logger.Slack.addReaction('clock4', message);
      const msg = message.match.input.replace(REGEX.ibizan, '').trim();
      const tz = user.timetable.timezone.name || TIMEZONE;
      const punch = Punch.parse(user, msg, mode, tz);
      if (!punch.projects.length && isProjectChannel(message.room)) {
        const project = Organization.getProjectByName(message.room);
        if (project) {
          punch.projects.push(project);
        }
      }
      let modeQualifier, article;
      if (punch.mode === 'none') {
        modeQualifier = 'block';
      } else {
        modeQualifier = punch.mode;
      }
      if (punch.mode === 'none' || punch.mode === 'vacation' || punch.mode === 'sick') {
        article = 'a';
      } else {
        article = 'an';
      }
      Logger.Console.log(`Successfully generated ${article} ${modeQualifier}-punch for @${user.slack}: ${punch.description(user)}`);
      sendPunch(punch, user, message);
    } else {
      const channelName = Logger.Slack.getChannelName(message.user.room);
      Logger.Slack.addReaction('x', message);
      user.directMessage(`You cannot punch in #${channelName}. Try punching in #${Organization.clockChannel}, a designated project channel, or here.`, Logger);
    }
  }

  // Send the punch to the Organization's Spreadsheet
  async function sendPunch(punch, user, message) {
    if (!punch) {
      Logger.Slack.errorToSlack(`Somehow, a punch was not generated for \"${user.slack}\". Punch:\n`, message.match.input);
      user.directMessage('An unexpected error occured while generating your punch.', Logger);
      return;
    }
    try {
      const enteredPunch = await Organization.spreadsheet.enterPunch(punch, user);
      Logger.Console.log(`@${user.slack}'s punch was successfully entered into the spreadsheet.`);
      const punchEnglish = `Punched you *${enteredPunch.description(user)}*.`;
      if (enteredPunch.mode === 'in') {
        user.directMessage(punchEnglish, Logger);
      } else {
        user.directMessage(punchEnglish, Logger, [ enteredPunch.slackAttachment() ]);
      }
      Logger.Slack.addReaction('dog2', message);
      Logger.Slack.removeReaction('clock4', message);
    } catch (err) {
      const errorMsg = Logger.Console.clean(err);
      Logger.Console.error(errorMsg);
      Logger.Slack.errorToSlack(`"${errorMsg}" was returned for ${user.slack}. Punch:\n`, message.match.input);
      user.directMessage(`\n${errorMsg}`, Logger);
      Logger.Slack.addReaction('x', message);
      Logger.Slack.removeReaction('clock4', message);
    }
  }

  // Punch for a given mode
  // respond
  // time.punchByMode, userRequired: true
  controller.hears(REGEX.modes, ['message_received'], (bot, message) => {
    parse(bot, message, message.match[1]);
  });

  // Punch for a block of time
  // respond
  // 'time.punchByTime', userRequired: true
  controller.hears(REGEX.rel_time, ['message_received'], (bot, message) => {
    parse(bot, message, message.match[1]);
  });

  // Switch projects during an 'in' punch
  // append to lastPunch
  // respond
  // time.append, userRequired: true
  controller.hears('(append|add)', ['message_received'], async (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const msg = message.match.input.replace(REGEX.ibizan, '').replace(/(append|add)/i, '').trim();
    const words = msg.split(' ');
    const operator = words[0];
    words.shift();
    const msgWithoutOperator = words.join(' ').trim();
    
    let results = '';
    if (operator === 'project' || operator === 'projects' || operator === 'note' || operator === 'notes') {
      const punch = user.lastPunch('in');
      if (!punch) {
        user.directMessage(strings.notpunchedin, Logger);
        return;
      }
      if (operator === 'project' || operator === 'projects') {
        const projects = msgWithoutOperator.split(' ');
        if (projects.length === 0 && isProjectChannel(message.user.room)) {
          projects.push(Organization.getProjectByName(message.user.room));
        }
        punch.appendProjects(projects);
        results = projects.join(', ') || '';
      } else if (operator === 'note' || operator === 'notes') {
        punch.appendNotes(msgWithoutOperator);
        results = `'${msgWithoutOperator}'`;
      }
      const row = punch.toRawRow(user.name);
      try {
        await Organization.spreadsheet.saveRow(row);
        user.directMessage(`Added ${operator} ${results}`, Logger);
        Logger.Slack.addReaction('dog2', message);
      } catch (err) {
        user.directMessage(err, Logger);
        Logger.Console.error('Unable to append row', new Error(err));
      }
    } else if (operator === 'event' || operator === 'calendar' || operator === 'upcoming') {
      Logger.Slack.addReaction('clock4', message);
      const date = moment(words[0], 'MM/DD/YYYY');
      if (!date.isValid()) {
        Logger.Slack.addReaction('x', message);
        Logger.Slack.removeReaction('clock4', message);
        bot.reply(message, 'Your event has an invalid date. Make sure you\'re using the proper syntax, emit.g. `ibizan add event 3/21 Dog Time`');
        return;
      }
      words.shift();
      const name = words.join(' ').trim();
      if (!name || name.length === 0) {
        Logger.Slack.addReaction('x', message)
        Logger.Slack.removeReaction('clock4', message);
        bot.reply(message, 'Your event needs a name. Make sure you\'re using the proper syntax, encode.g. `ibizan add event 3/21 Dog Time`');
        return;
      }
      Logger.Console.debug(`Adding event on ${date} named ${name}`);
      try {
        const calendarEvent = await Organization.addEvent(date, name);
        Logger.Slack.addReaction('dog2', message);
        Logger.Slack.removeReaction('clock4', message);
        bot.reply(message, `Added new event: *${calendarEvent.name}* on *${calendarEvent.date.format('M/DD/YYYY')}*`);
      } catch (err) {
        Logger.Console.error(err);
        Logger.Slack.addReaction('x', message);
        Logger.Slack.removeReaction('clock4', message);
        bot.reply(message, 'Something went wrong when adding your event.');
      }
    } else {
      user.directMessage(strings.addfail, Logger);
    }
  });

  // respond
  // time.undo, userRequired: true
  controller.hears('undo', ['message_received'], async (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    if (user.punches && user.punches.length > 0) {
      Logger.Slack.addReaction('clock4', message);
      let punch;
      let lastPunch = user.lastPunch();
      const lastPunchDescription = lastPunch.description(user);
      try {
        await user.undoPunch();
        await user.updateRow();
        Logger.Slack.addReaction('dog2', message);
        Logger.Slack.removeReaction('clock4', message);
        user.directMessage(`Undid your last punch, which was: *${lastPunchDescription}*\n\nYour most current punch is now: *${user.lastPunch().description(user)}*`, Logger);
      } catch (err) {
        Logger.Slack.errorToSlack(`"${err}" was returned for an undo operation by ${user.slack}`);
        user.directMessage('Something went horribly wrong while undoing your punch.', Logger);
      }
    } else {
      user.directMessage(strings.undofail, Logger);
    }
  });      

  // respond
  // time.events
  controller.hears('\b(events|upcoming)$', ['message_received'], (bot, message) => {
    let response = '';
    const upcomingEvents = Organization.calendar.upcomingEvents();
    if (upcomingEvents.length > 0) {
      response += 'Upcoming events:\n';
      for (let calendarEvent of upcomingEvents) {
        response += `*${calendarEvent.date.format('M/DD/YY')}* - ${calendarEvent.name}\n`;
      }
    } else {
      response = strings.noevents;
    }
    bot.say({
      text: response,
      channel: message.channel
    });
    Logger.Slack.addReaction('dog2', message);
  });

  /** User feedback **/

  // Gives helpful info if a user types 'hours' with no question mark or date
  // respond
  // time.hoursHelp
  controller.hears('\bhours$', ['message_received'], (bot, message) => {
    bot.say({
      text: strings.hourshelp,
      channel: message.channel
    });
    Logger.Slack.addReaction('dog2', message);
  });

  // Returns the hours worked on a given date
  // respond
  // time.hoursOnDate, userRequired: true
  controller.hears('hours (.*)', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const tz = user.timetable.timezone.name;
    const date = moment(message.match[1], 'MM/DD/YYYY');
    if (!date.isValid()) {
      Logger.Console.log(`hours: ${message.match[1]} is an invalid date`);
      user.directMessage(`${message.match[1]} is not a valid date`, Logger);
      Logger.Slack.addReaction('x', message);
      return;
    }
    const formattedDate = date.format('dddd, MMMM D, YYYY');

    const attachments = [];
    const headers = HEADERS.payrollreports;

    const startOfDay = moment.tz(date, tz).startOf('day');
    const endOfDay = moment.tz(date, tz).endOf('day');
    const report = user.toRawPayroll(startOfDay, endOfDay);
    for (let punch of user.punches) {
      if (punch.date.isBefore(startOfDay) || punch.date.isAfter(endOfDay)) {
        continue;
      }
      attachments.push(punch.slackAttachment());
    }

    let loggedAny = false;
    let msg;
    if (!report[headers.logged] && !report[headers.vacation] && !report[headers.sick] && !report[headers.unpaid]) {
      msg = `You haven't recorded any hours on ${formattedDate}`;
    } else {
      if (!report[headers.logged]) {
        msg = 'You haven\'t recorded any paid work time';
      } else {
        msg = `You have *${toTimeStr(report[headers.logged])} of paid work time*`;
        loggedAny = true;
      }
      for (let kind of ['vacation', 'sick', 'unpaid']) {
        const header = headers[kind];
        if (kind === 'unpaid') {
          kind = 'unpaid work';
        }
        if (report[header]) {
          if (!loggedAny) {
            msg += `, but you have *${toTimeStr(report[header])} of ${kind} time*`;
            loggedAny = true;
          } else {
            msg += ` and *${toTimeStr(report[header])} of ${kind} time*`;
          }
        }
      }
      msg += ` recorded for ${formattedDate}`;
    }
    if (report.extra && report.extra.projects && report.extra.projects.length > 0) {
      msg += ' (';
      for (let project of report.extra.projects) {
        msg += `#${project.name}`;
      }
      msg += ')';
    }
    Logger.Slack.addReaction('dog2', message);
    user.directMessage(msg, Logger, attachments);
  });

  // Returns the hours worked for the given time period
  // respond
  // time.hours, userRequired: true
  controller.hears('.*(hours|today|week|month|year|period)+[\?\!\.¿¡]', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const tz = user.timetable.timezone.name;
    const now = moment.tz(tz);
    const attachments = [];
    const mode = message.match[1].toLowerCase();
    const headers = HEADERS.payrollreports;
    
    let report, dateArticle;
    if (mode === 'week') {
      const sunday = moment({
        hour: 0, 
        minute: 0, 
        second: 0
      }).day('Sunday');
      report = user.toRawPayroll(sunday, now);
      dateArticle = 'this week';

      for (let punch of user.punches) {
        if (punch.date.isBefore(sunday) || punch.date.isAfter(now)) {
          continue;
        } else if (!punch.elapsed && !punch.times.block) {
          continue;
        }
        attachments.push(punch.slackAttachment());
      }
    } else if (mode === 'month') {
      const startOfMonth = moment.tz({
        hour: 0, 
        minute: 0, 
        second: 0
      }, tz).startOf('month');
      report = user.toRawPayroll(startOfMonth, now);
      dateArticle = 'this month';
    } else if (mode === 'year') {
      const startOfYear = moment.tz({
        hour: 0, 
        minute: 0, 
        second: 0
      }, tz).startOf('year');
      report = user.toRawPayroll(startOfYear, now);
      dateArticle = 'this year';
    } else if (mode === 'period') {
      let periodStart = moment({
        hour: 0, 
        minute: 0, 
        second: 0
      }).day('Sunday');
      if (Organization.calendar.isPayWeek()) {
        periodStart = periodStart.subtract(1, 'weeks');
      }
      let periodEnd = periodStart.clone().add(2, 'weeks');
      if (message.match[0].match(/(last|previous)/)) {
        periodStart = periodStart.subtract(2, 'weeks');
        periodEnd = periodEnd.subtract(2, 'weeks');
        dateArticle = `last pay period (${periodStart.format('M/DD')} to ${periodEnd.format('M/DD')})`;
      } else {
        dateArticle = `this pay period (${periodStart.format('M/DD')} to ${periodEnd.format('M/DD')})`;
      }
      report = user.toRawPayroll(periodStart, periodEnd);
      for (let punch of user.punches) {
        if (punch.date.isBefore(periodStart) || punch.date.isAfter(periodEnd)) {
          continue;
        } else if (!punch.elapsed && !punch.times.block) {
          continue;
        }
        attachments.push(punch.slackAttachment());
      }
    } else {
      const earlyToday = now.clone().hour(0).minute(0).second(0).subtract(1, 'minutes');
      report = user.toRawPayroll(earlyToday, now);
      dateArticle = 'today';
      for (let punch of user.punches) {
        if (punch.date.isBefore(earlyToday) || punch.date.isAfter(now)) {
          continue;
        }
        attachments.push(punch.slackAttachment());
      }
    }

    let loggedAny = false
    let msg;
    if (!report[headers.logged] && !report[headers.vacation] && !report[headers.sick] && !report[headers.unpaid]) {
      msg = `You haven't recorded any hours ${dateArticle}.`;
    } else {
      if (!report[headers.logged]) {
        msg = 'You haven\'t recorded any paid work time';
      } else {
        msg = `You have *${toTimeStr(report[headers.logged])} of paid work time*`;
        loggedAny = true
      }
      for (let kind of ['vacation', 'sick', 'unpaid']) {
        const header = headers[kind];
        if (kind === 'unpaid') {
          kind = 'unpaid work';
        }
        if (report[header]) {
          if (!loggedAny) {
            msg += `, but you have *${toTimeStr(report[header])} of ${kind} time*`;
            loggedAny = true;
          } else {
            msg += ` and *${toTimeStr(report[header])} of ${kind} time*`;
          }
        }
      }
      msg += ' recorded for ${dateArticle}.';
    }
    if (report.extra && report.extra.projects && report.extra.projects.length > 0) {
      msg += ' (';
      for (let project of report.extra.projects) {
        msg += `#${project.name}`;
      }
      msg += ')';
    }

    Logger.Slack.addReaction('dog2', message);
    user.directMessage(msg, Logger, attachments);
  });

  // Returns the user's info as a slackAttachment
  // respond
  // time.status, userRequired: true
  controller.hears('\b(status|info)$', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    user.directMessage('Your status:', Logger, [ user.slackAttachment() ]);
    Logger.Slack.addReaction('dog2', message);
  });

  // Returns the user's time in their timezone, as well as Ibizan's default time
  // respond
  // time.time, userRequired: true
  controller.hears('\btime$', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const userTime = moment.tz(user.timetable.timezone.name);
    const ibizanTime = moment.tz(TIMEZONE);
    let msg = `It's currently *${userTime.format('h:mm A')}* in your timezone (${userTime.format('z, Z')}).`
    if (userTime.format('z') !== ibizanTime.format('z')) {
      msg += `\n\nIt's ${ibizanTime.format('h:mm A')} in the default timezone (${ibizanTime.format('z, Z')}).`;
    }
    user.directMessage(msg, Logger);
    Logger.Slack.addReaction('dog2', message);
  });

  // Returns the user's timezone
  // respond
  // time.time, userRequired: true
  controller.hears('\btimezone$', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const userTime = moment.tz(user.timetable.timezone.name);
    user.directMessage(`Your timezone is set to *${user.timetable.timezone.name}* (${userTime.format('z, Z')}).`, Logger);
    Logger.Slack.addReaction('dog2', message);
  });

  // Sets the user's timezone
  // respond
  // time.time, userRequired: true
  controller.hears('timezone (.*)', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    let input = message.match[1];
    let isTzSet = false;
    let tz = user.setTimezone(input);

    if (tz) {
      isTzSet = true;
    } else {
      // Try adding 'America/' if a region is not specified
      if (input.indexOf('/') === -1) {
        input = 'America/' + input;
      }
      if (tz = user.setTimezone(input)) {
        isTzSet = true;
      } else {
        // Try changing spaces to underscores
        input = input.replace(' ', '_');
        if (tz = user.setTimezone(input)) {
          isTzSet = true;
        }
      }
    }
    if (isTzSet) {
      const userTime = moment.tz(user.timetable.timezone.name);
      user.directMessage(`Your timezone is now *${user.timetable.timezone.name}* (${userTime.format('z, Z')}).`, Logger);
    } else {
      user.directMessage('I do not recognize that timezone. Check <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List|this list> for a valid time zone name.', Logger);
      Logger.Slack.addReaction('x', message);
    }
  });

  // Sets the user's active times
  // respond
  // time.active, userRequired: true
  controller.hears('active\s*(.*)?$', ['message_received'], (bot, message) => {
    const user = Organization.getUserBySlackName(message.user.name);
    const command = message.match[1];
    
    if (!command) {
      bot.say({
        text: strings.activehelp,
        channel: message.channel
      });
      Logger.Slack.addReaction('dog2', message);
      return;
    }

    const comps = command.split(' ') || [];
    const scope = comps[0] || 'unknown';
    const time = comps[1] || 'notime';

    if (scope !== 'unknown' && time !== 'notime') {
      const newTime = moment.tz(time, 'h:mm A', user.timetable.timezone.name);
      if (!newTime.isValid()) {
        user.directMessage(`${time} is not a valid timers.`, Logger);
        Logger.Slack.addReaction('x', message);
        return;
      }
      if (scope === 'start') {
        if (!newTime.isBefore(user.timetable.end)) {
          user.directMessage(`${newTime.format('h:mm A')} is not before your current end time of ${user.timetable.start.format('h:mm A')}.`, Logger);
          Logger.Slack.addReaction('x', message);
          return;
        }
        user.setStart(newTime);
      } else if (scope === 'end') {
        if (!newTime.isAfter(user.timetable.start)) {
          user.directMessage(`${newTime.format('h:mm A')} is not after your current start time of ${user.timetable.start.format('h:mm A')}.`, Logger);
          Logger.Slack.addReaction('x', message);
          return;
        }
        user.setEnd(newTime);
      }
      user.directMessage(`Your active *${scope}* time is now *${newTime.format('h:mm A')}*.`, Logger);
      Logger.Slack.addReaction('dog2', message);
    } else {
      user.directMessage(strings.activefail, Logger);
      Logger.Slack.addReaction('x', message);
    }
  });
};