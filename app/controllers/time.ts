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

import * as moment from 'moment-timezone';

import { REGEX, REGEX_STR, STRINGS, EVENTS, TIMEZONE } from '../shared/constants';
const strings = STRINGS.time;
import { Message, isDMChannel } from '../shared/common';
import { Rows } from '../shared/rows';
import { Console, Slack } from '../logger';
import { Punch } from '../models/punch';
import { User } from '../models/user';
import { Organization } from '../models/organization';
import { buildOptions } from '../middleware/access';

export default function (controller: botkit.Controller) {
  function canPunchHere(channel: string, organization: Organization) {
    return isDMChannel(channel) || organization.matchesClockChannel(channel) || organization.matchesProject(channel);
  }

  function toTimeStr(duration: number) {
    const hours = Math.floor(duration);
    let hoursStr;
    if (hours === 1) {
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
  function parse(bot: botkit.Bot, message: Message, mode: string, organization: Organization) {
    mode = mode.toLowerCase();
    const channel = message.channel_obj;
    const user = organization.getUserBySlackName(message.user_obj.name);
    Console.info(`Parsing '${message.text}' for @${user.slackName}.`);
    const isAllowed = canPunchHere(channel.id, organization);
    if (!isAllowed) {
      Slack.addReaction('x', message);
      user.directMessage(`You cannot punch in #${channel.name}. Try punching in #${organization.clockChannel}, a designated project channel, or here.`);
      return;
    }
    Slack.addReaction('clock4', message);
    const msg = message.match.input.replace(REGEX.ibizan, '').trim();
    const tz = user.timetable.timezone.name || TIMEZONE;
    const punch = Punch.parse(organization, user, msg, mode, tz);
    const channelIsProject = organization.matchesProject(channel.name);
    if (!punch.projects.length && channelIsProject) {
      const project = organization.getProjectByName(channel.name);
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
    Console.info(`Successfully generated ${article} ${modeQualifier}-punch for @${user.slackName}: ${punch.description(user)}`);
    sendPunch(punch, user, message, organization);
  }

  // Send the punch to the org's Spreadsheet
  async function sendPunch(punch: Punch, user: User, message: Message, organization: Organization) {
    if (!punch) {
      Slack.error(`Somehow, a punch was not generated for \"${user.slackName}\". Punch:\n`, message.match.input);
      user.directMessage('An unexpected error occured while generating your punch.');
      return;
    }
    try {
      const enteredPunch = await organization.spreadsheet.enterPunch(punch, user, organization);
      Console.info(`@${user.slackName}'s punch was successfully entered into the spreadsheet.`);
      const punchEnglish = `Punched you *${enteredPunch.description(user)}*.`;
      if (enteredPunch.mode === 'in') {
        user.directMessage(punchEnglish);
      } else {
        const attachments = [ enteredPunch.slackAttachment() ];
        user.directMessage(punchEnglish, attachments);
      }
      Slack.addReaction('dog2', message);
      Slack.removeReaction('clock4', message);
    } catch (err) {
      const errorMsg = Console.clean(err);
      Console.error(errorMsg);
      Slack.error(`"${errorMsg}" was returned for ${user.slackName}. Punch:\n`, message.match.input);
      user.directMessage(`\n${errorMsg}`);
      Slack.addReaction('x', message);
      Slack.removeReaction('clock4', message);
    }
  }

  // Punch for a given mode
  // respond
  // time.punchByMode, userRequired: true
  controller.hears(REGEX_STR.modes,
    EVENTS.respond,
    buildOptions({ id: 'time.punchByMode', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      parse(bot, message, message.match[1], organization);
    });

  // Punch for a block of time
  // respond
  // 'time.punchByTime', userRequired: true
  controller.hears(REGEX_STR.rel_time,
    EVENTS.respond,
    buildOptions({ id: 'time.punchByTime', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      parse(bot, message, message.match[1], organization);
    });

  // Switch projects during an 'in' punch
  // append to lastPunch
  // respond
  // time.append, userRequired: true
  controller.hears('(append|add)',
    EVENTS.respond,
    buildOptions({ id: 'time.append', userRequired: true }, controller),
    async (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const channelName = message.channel_obj.name;
      const user = organization.getUserBySlackName(message.user_obj.name);
      const msg = message.match.input.replace(REGEX.ibizan, '').replace(/(append|add)/i, '').trim();
      const words = msg.split(' ');
      const operator = words[0];
      words.shift();
      const msgWithoutOperator = words.join(' ').trim();

      let results = '';
      if (operator === 'project' || operator === 'projects' || operator === 'note' || operator === 'notes') {
        const punch = user.lastPunch('in');
        if (!punch) {
          user.directMessage(strings.notpunchedin);
          return;
        }
        if (operator === 'project' || operator === 'projects') {
          const projectNames = msgWithoutOperator.split(' ');
          const projects = [];
          const channelIsProject = organization.matchesProject(channelName);
          if (projectNames.length === 0 && channelIsProject) {
            projects.push(organization.getProjectByName(channelName));
          }
          punch.appendProjects(organization, projects);
          results = projects.join(', ') || '';
        } else if (operator === 'note' || operator === 'notes') {
          punch.appendNotes(msgWithoutOperator);
          results = `'${msgWithoutOperator}'`;
        }
        const row = punch.toRawRow(user.realName);
        try {
          await organization.spreadsheet.saveRow(row, 'rawData');
          user.directMessage(`Added ${operator} ${results}`);
          Slack.addReaction('dog2', message);
        } catch (err) {
          user.directMessage(err);
          Console.error('Unable to append row', new Error(err));
        }
      } else if (operator === 'event' || operator === 'calendar' || operator === 'upcoming') {
        Slack.addReaction('clock4', message);
        const date = moment(words[0], 'MM/DD/YYYY');
        if (!date.isValid()) {
          Slack.addReaction('x', message);
          Slack.removeReaction('clock4', message);
          bot.reply(message, 'Your event has an invalid date. Make sure you\'re using the proper syntax, emit.g. `ibizan add event 3/21 Dog Time`');
          return;
        }
        words.shift();
        const name = words.join(' ').trim();
        if (!name || name.length === 0) {
          Slack.addReaction('x', message)
          Slack.removeReaction('clock4', message);
          bot.reply(message, 'Your event needs a name. Make sure you\'re using the proper syntax, encode.g. `ibizan add event 3/21 Dog Time`');
          return;
        }
        Console.debug(`Adding event on ${date} named ${name}`);
        try {
          const calendarEvent = await organization.addEvent(date, name);
          Slack.addReaction('dog2', message);
          Slack.removeReaction('clock4', message);
          bot.reply(message, `Added new event: *${calendarEvent.name}* on *${calendarEvent.date.format('M/DD/YYYY')}*`);
        } catch (err) {
          Console.error(err);
          Slack.addReaction('x', message);
          Slack.removeReaction('clock4', message);
          bot.reply(message, 'Something went wrong when adding your event.');
        }
      } else {
        user.directMessage(strings.addfail);
      }
    });

  // respond
  // time.undo, userRequired: true
  controller.hears('undo',
    EVENTS.respond,
    buildOptions({ id: 'time.undo', userRequired: true }, controller),
    async (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      if (user.punches && user.punches.length > 0) {
        Slack.addReaction('clock4', message);
        let punch;
        let lastPunch = user.lastPunch();
        const lastPunchDescription = lastPunch.description(user);
        try {
          await user.undoPunch();
          await user.updateRow();
          Slack.addReaction('dog2', message);
          Slack.removeReaction('clock4', message);
          user.directMessage(`Undid your last punch, which was: *${lastPunchDescription}*\n\nYour most current punch is now: *${user.lastPunch().description(user)}*`);
        } catch (err) {
          Slack.error(`"${err}" was returned for an undo operation by ${user.slackName}`);
          user.directMessage('Something went horribly wrong while undoing your punch.');
        }
      } else {
        user.directMessage(strings.undofail);
      }
    });

  // respond
  // time.events
  controller.hears('\b(events|upcoming)$',
    EVENTS.respond,
    buildOptions({ id: 'time.events' }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      let response = '';
      const upcomingEvents = organization.calendar.upcomingEvents();
      if (upcomingEvents.length > 0) {
        response += 'Upcoming events:\n';
        for (let calendarEvent of upcomingEvents) {
          response += `*${calendarEvent.date.format('M/DD/YY')}* - ${calendarEvent.name}\n`;
        }
      } else {
        response = strings.noevents;
      }
      const msg = {
        text: response,
        channel: message.channel
      } as Message;
      bot.say(msg);
      Slack.addReaction('dog2', message);
    });

  /** User feedback **/

  // Gives helpful info if a user types 'hours' with no question mark or date
  // respond
  // time.hoursHelp
  controller.hears('\bhours$',
    EVENTS.respond,
    buildOptions({ id: 'time.hoursHelp' }, controller),
    (bot, message) => {
      const msg = {
        text: strings.hourshelp,
        channel: message.channel
      } as Message;
      bot.say(msg);
      Slack.addReaction('dog2', message);
    });

  // Returns the hours worked on a given date
  // respond
  // time.hoursOnDate, userRequired: true
  controller.hears('hours (.*)',
    EVENTS.respond,
    buildOptions({ id: 'time.hoursOnDate', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      const tz = user.timetable.timezone.name;
      const date = moment(message.match[1], 'MM/DD/YYYY');
      if (!date.isValid()) {
        Console.info(`hours: ${message.match[1]} is an invalid date`);
        user.directMessage(`${message.match[1]} is not a valid date`);
        Slack.addReaction('x', message);
        return;
      }
      const formattedDate = date.format('dddd, MMMM D, YYYY');

      const attachments = [];

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
      if (!report.logged && !report.vacation && !report.sick && !report.unpaid) {
        msg = `You haven't recorded any hours on ${formattedDate}`;
      } else {
        if (!report.logged) {
          msg = 'You haven\'t recorded any paid work time';
        } else {
          msg = `You have *${toTimeStr(+report.logged)} of paid work time*`;
          loggedAny = true;
        }
        for (let kind of ['vacation', 'sick', 'unpaid']) {
          if (report[kind]) {
            const value = +report[kind];
            if (!loggedAny) {
              msg += `, but you have *${toTimeStr(value)} of ${kind}${kind === 'unpaid' ? 'work' : ''} time*`;
              loggedAny = true;
            } else {
              msg += ` and *${toTimeStr(value)} of ${kind} time*`;
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
      Slack.addReaction('dog2', message);
      user.directMessage(msg, attachments);
    });

  // Returns the hours worked for the given time period
  // respond
  // time.hours, userRequired: true
  controller.hears('.*(hours|today|week|month|year|period)+[\?\!\.¿¡]',
    EVENTS.respond,
    buildOptions({ id: 'time.hours', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      const tz = user.timetable.timezone.name;
      const now = moment.tz(tz);
      const attachments = [];
      const mode = message.match[1].toLowerCase();

      let report: Rows.PayrollReportsRow;
      let dateArticle;
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
        if (organization.calendar.isPayWeek()) {
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
      if (!report.logged && !report.vacation && !report.sick && !report.unpaid) {
        msg = `You haven't recorded any hours ${dateArticle}.`;
      } else {
        if (!report.logged) {
          msg = 'You haven\'t recorded any paid work time';
        } else {
          msg = `You have *${toTimeStr(+report.logged)} of paid work time*`;
          loggedAny = true
        }
        for (let kind of ['vacation', 'sick', 'unpaid']) {
          if (report[kind] && report[kind] > 0) {
            if (!loggedAny) {
              msg += `, but you have *${toTimeStr(+report[kind])} of ${kind}${kind === 'unpaid' ? 'work' : ''} time*`;
              loggedAny = true;
            } else {
              msg += ` and *${toTimeStr(+report[kind])} of ${kind} time*`;
            }
          }
        }
        msg += ` recorded for ${dateArticle}.`;
      }
      if (report.extra && report.extra.projects && report.extra.projects.length > 0) {
        msg += ' (';
        for (let project of report.extra.projects) {
          msg += `#${project.name} `;
        }
        msg += ')';
        msg = msg.replace(' )', ')');
      }

      Slack.addReaction('dog2', message);
      user.directMessage(msg, attachments);
    });

  // Returns the user's info as a slackAttachment
  // respond
  // time.status, userRequired: true
  controller.hears('\b(status|info)$',
    EVENTS.respond,
    buildOptions({ id: 'time.status', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      user.directMessage('Your status:', [user.slackAttachment()]);
      Slack.addReaction('dog2', message);
    });

  // Returns the user's time in their timezone, as well as Ibizan's default time
  // respond
  // time.time, userRequired: true
  controller.hears('\btime$',
    EVENTS.respond,
    buildOptions({ id: 'time.time', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      const userTime = moment.tz(user.timetable.timezone.name);
      const ibizanTime = moment.tz(TIMEZONE);
      let msg = `It's currently *${userTime.format('h:mm A')}* in your timezone (${userTime.format('z, Z')}).`
      if (userTime.format('z') !== ibizanTime.format('z')) {
        msg += `\n\nIt's ${ibizanTime.format('h:mm A')} in the default timezone (${ibizanTime.format('z, Z')}).`;
      }
      user.directMessage(msg);
      Slack.addReaction('dog2', message);
    });

  // Returns the user's timezone
  // respond
  // time.time, userRequired: true
  controller.hears('\btimezone$',
    EVENTS.respond,
    buildOptions({ id: 'time.time', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      const userTime = moment.tz(user.timetable.timezone.name);
      user.directMessage(`Your timezone is set to *${user.timetable.timezone.name}* (${userTime.format('z, Z')}).`);
      Slack.addReaction('dog2', message);
    });

  // Sets the user's timezone
  // respond
  // time.time, userRequired: true
  controller.hears('timezone (.*)',
    EVENTS.respond,
    buildOptions({ id: 'time.time', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
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
        user.directMessage(`Your timezone is now *${user.timetable.timezone.name}* (${userTime.format('z, Z')}).`);
      } else {
        user.directMessage('I do not recognize that timezone. Check <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List|this list> for a valid time zone name.');
        Slack.addReaction('x', message);
      }
    });

  // Sets the user's active times
  // respond
  // time.active, userRequired: true
  controller.hears('active\s*(.*)?$',
    EVENTS.respond,
    buildOptions({ id: 'time.active', userRequired: true }, controller),
    (bot, message: Message) => {
      const organization: Organization = message.organization;
      if (!organization) {
        Console.error('No Organization was found for the team: ' + bot);
        return;
      }
      const user = organization.getUserBySlackName(message.user_obj.name);
      const command = message.match[1];

      if (!command) {
        const msg = {
          text: strings.activehelp,
          channel: message.channel
        } as Message;
        bot.say(msg);
        Slack.addReaction('dog2', message);
        return;
      }

      const comps = command.split(' ') || [];
      const scope = comps[0] || 'unknown';
      const time = comps[1] || 'notime';

      if (scope !== 'unknown' && time !== 'notime') {
        const newTime = moment.tz(time, 'h:mm A', user.timetable.timezone.name);
        if (!newTime.isValid()) {
          user.directMessage(`${time} is not a valid timers.`);
          Slack.addReaction('x', message);
          return;
        }
        if (scope === 'start') {
          if (!newTime.isBefore(user.timetable.end)) {
            user.directMessage(`${newTime.format('h:mm A')} is not before your current end time of ${user.timetable.start.format('h:mm A')}.`);
            Slack.addReaction('x', message);
            return;
          }
          user.setStart(newTime);
        } else if (scope === 'end') {
          if (!newTime.isAfter(user.timetable.start)) {
            user.directMessage(`${newTime.format('h:mm A')} is not after your current start time of ${user.timetable.start.format('h:mm A')}.`);
            Slack.addReaction('x', message);
            return;
          }
          user.setEnd(newTime);
        }
        user.directMessage(`Your active *${scope}* time is now *${newTime.format('h:mm A')}*.`);
        Slack.addReaction('dog2', message);
      } else {
        user.directMessage(strings.activefail);
        Slack.addReaction('x', message);
      }
    });
};