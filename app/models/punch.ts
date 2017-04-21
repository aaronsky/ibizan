import * as moment from 'moment-timezone';
const weekend = require('moment-weekend');
import * as uuid from 'node-uuid';

import { Mode } from '../shared/common';
import { MODES, REGEX, TIMEZONE } from '../shared/constants';
import { holidayForMoment } from '../shared/moment-holiday';
import { Console } from '../logger';
import { Organization } from './organization';
import { Project } from './project';
import { Rows } from './rows';
import { Sheets } from './sheet';
import { User } from './user';

interface PunchTime extends Array<moment.Moment> {
  start?: moment.Moment;
  end?: moment.Moment;
  block?: number;
};

function mergeDateTime(date: moment.Moment, time: moment.Moment, tz: string = TIMEZONE) {
  return moment.tz({
    year: date.get('year'),
    month: date.get('month'),
    date: date.get('date'),
    hour: time.get('hour'),
    minute: time.get('minute'),
    second: time.get('second')
  }, tz);
}
function parseMode(command: string): [string, string] {
  const comps = command.split(' ');
  let [mode, commandWithoutMode] = [comps.shift(), comps.join(' ')];
  mode = mode || '';
  mode = mode.toLowerCase();
  mode = mode.trim();
  commandWithoutMode = commandWithoutMode || '';
  commandWithoutMode = commandWithoutMode.trim();
  if (MODES.indexOf(mode) !== -1) {
    return [mode, commandWithoutMode];
  }
  return ['none', commandWithoutMode];
}
function parseTime(command: string, activeStart: moment.Moment, activeEnd: moment.Moment, tz: string): [PunchTime, string] {
  // parse time component
  command = command.replace(/^\s+/, '') || '';
  if (command.indexOf('at') === 0) {
    command = command.replace('at', '');
    command = command.replace(/^\s+/, '');
  }
  const activeTime = +(activeEnd.diff(activeStart, 'hours', true).toFixed(2));
  const time: PunchTime = [];
  let match;
  if (match = command.match(REGEX.rel_time)) {
    if (match[0] === 'half-day' || match[0] === 'half day') {
      const halfTime = activeTime / 2;
      const midTime = moment(activeStart).add(halfTime, 'hours');
      const period = moment().diff(activeStart, 'hours', true) <= halfTime ? 'early' : 'later';
      if (period === 'early') {
        // start to mid
        time.push(moment(activeStart), midTime);
      } else {
        // mid to end
        time.push(midTime, moment(activeEnd));
      }
    } else if (match[0] === 'noon') {
      time.push(moment({
        hour: 12,
        minute: 0
      }));
    } else if (match[0] === 'midnight') {
      time.push(moment({
        hour: 0,
        minute: 0
      }));
    } else {
      const block_str = match[0].replace('hours', '').replace('hour', '').replace(/\s+$/, '');
      const block = parseFloat(block_str);
      time.block = block
    }
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  } else if (match = command.match(REGEX.time)) {
    let timeMatch = match[0];
    const now = moment.tz(tz);
    let hourStr, period;
    if (hourStr = timeMatch.match(/\b((0?[1-9]|1[0-2])|(([0-1][0-9])|(2[0-3]))):/i)) {
      const hour = parseInt(hourStr[0].replace(':', ''));
      if (hour <= 12) {
        if (!timeMatch.match(/(a|p)m?/i)) {
          // Inferred period
          period = now.format('a');
          timeMatch = `${timeMatch} ${period}`;
        }
      }
    }
    const today = moment(timeMatch, 'h:mm a');
    if (period && today.isAfter(now)) {
      if (today.diff(now, 'hours', true) > 6) {
        today.subtract(12, 'hours');
      }
    }
    time.push(today);
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  }
  return [time, command];
}
function parseDate(command: string): [moment.Moment[], string] {
  command = command.replace(/^\s+/, '') || '';
  if (command.indexOf('on') === 0) {
    command = command.replace('on', '');
    command = command.replace(/^\s+/, '');
  }
  const date = [];
  let match;
  if (match = command.match(/today/i)) {
    date.push(moment());
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  } else if (match = command.match(/yesterday/i)) {
    const yesterday = moment().subtract(1, 'days');
    date.push(yesterday);
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  } else if (match = command.match(REGEX.days)) {
    let today = moment();
    if (today.format('dddd').toLowerCase() !== match[0]) {
      today = today.day(match[0]).subtract(7, 'days');
    }
    date.push(today);
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  } else if (match = command.match(REGEX.date)) {
    // Placeholder for date blocks
    if (match[0].indexOf('-') !== -1) {
      const dateStrings = match[0].split('-')
      let month = ''
      for (let str of dateStrings) {
        str = str.trim()
        if (!isNaN(+str) && month) {
          str = month + ' ' + str
        }
        const newDate = moment(str, "MMMM DD");
        month = newDate.format('MMMM');
        date.push(newDate);
      }
    } else {
      const absDate = moment(match[0], "MMMM DD");
      date.push(absDate);
    }
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  } else if (match = command.match(REGEX.numdate)) {
    if (match[0].indexOf('-') !== -1) {
      const dateStrings = match[0].split('-')
      let month = ''
      for (let str of dateStrings) {
        str = str.trim();
        date.push(moment(str, 'MM/DD'));
      }
    } else {
      const absDate = moment(match[0], 'MM/DD');
      date.push(absDate);
    }
    const pattern = new RegExp(match[0] + ' ?', 'i');
    command = command.replace(pattern, '');
  }
  return [date, command];
}
function calculateElapsed(start: moment.Moment, end: moment.Moment, mode: string, user?: User): number {
  let elapsed = end.diff(start, 'hours', true);
  if (!user) {
    return +elapsed.toFixed(2);
  }
  if (mode === 'vacation' || mode === 'sick') {
    const [activeStart, activeEnd] = user.activeHours;
    const activeTime = user.activeTime;
    const inactiveTime = +moment(activeStart).add(1, 'days').diff(activeEnd, 'hours', true).toFixed(2);
    let numDays, numWeekends;
    if (start && start.isValid() && end && end.isValid()) {
      numDays = end.diff(start, 'days');
      let holidays = 0;
      const currentDate = moment(start);
      while (currentDate.isSameOrBefore(end)) {
        const holidayStr = holidayForMoment(currentDate);
        const dayOfWeek = currentDate.day();
        if (holidayStr && dayOfWeek !== 0 && dayOfWeek !== 6) {
          holidays += 1;
        }
        currentDate.add(1, 'days');
      }
      const numWorkdays = weekend.diff(start, end) - holidays;
      numWeekends = numDays - numWorkdays;
    }
    if (elapsed > activeTime && numDays) {
      elapsed -= (inactiveTime * numDays) + (activeTime * numWeekends);
    }
  }
  return +elapsed.toFixed(2);
}
function parseProjects(command: string, organization: Organization): [Project[], string] {
  const projects: Project[] = [];
  command = command.replace(/^\s+/, '') || '';
  if (command.indexOf('in') === 0) {
    command = command.replace('in', '');
    command = command.replace(/^\s+/, '');
  }
  const commandCopy = command.split(' ').slice();
  for (let word of commandCopy) {
    let project;
    if (project = organization.getProjectByName(word)) {
      projects.push(project);
      const pattern = new RegExp(word + ' ?', 'i');
      command = command.replace(pattern, '');
    }
  }
  return [projects, command];
}

export class Punch {
  mode: Mode;
  times: PunchTime;
  projects: Project[];
  notes: string;
  date: moment.Moment;
  timezone: string;
  elapsed?: number;
  row: Rows.RawDataRow;

  constructor(mode: Mode, times: PunchTime, projects: Project[], notes: string) {
    this.mode = mode;
    this.times = times;
    this.projects = projects;
    this.notes = notes;
  }
  static parse(organization: Organization, user: User, command: string, mode: Mode = 'none', timezone?: string) {
    if (!user) {
      Console.error('No user passed', new Error(command));
      return;
    } else if (!command) {
      Console.error('No command passed', new Error(user.toString()));
      return;
    }
    if (mode && mode !== 'none') {
      const [mode, commandWithoutMode] = parseMode(command);
      command = commandWithoutMode;
    }
    const original = command.slice(0);
    const [start, end] = user.activeHours;
    const tz: string = timezone || user.timetable.timezone.name;
    const [times, commandWithoutTime] = parseTime(command, start, end, tz);
    command = commandWithoutTime;
    const [dates, commandWithoutDate] = parseDate(command);
    command = commandWithoutDate;

    let datetimes: PunchTime = [];
    if (dates.length === 0 && times.length === 0) {
      datetimes.push(moment.tz(tz));
    } else if (dates.length > 0 && times.length === 0) {
      datetimes.push(mergeDateTime(dates[0], start, tz));
      datetimes.push(mergeDateTime(dates[dates.length - 1], end, tz));
    } else if (dates.length === 0 && times.length > 0) {
      for (let time of times) {
        datetimes.push(mergeDateTime(moment.tz(tz), time, tz));
      }
    } else {
      if (dates.length === 2 && times.length === 2) {
        datetimes.push(mergeDateTime(dates[0], times[0], tz));
        datetimes.push(mergeDateTime(dates[1], times[1], tz));
      } else if (dates.length === 2 && times.length === 1) {
        datetimes.push(mergeDateTime(dates[0], times[0], tz));
        datetimes.push(mergeDateTime(dates[1], times[0], tz));
      } else if (dates.length === 1 && times.length === 2) {
        datetimes.push(mergeDateTime(dates[0], times[0], tz));
        datetimes.push(mergeDateTime(dates[0], times[1], tz));
      } else {
        datetimes.push(mergeDateTime(dates[0], times[0], tz));
      }
    }

    let date, elapsed;
    if (times.block) {
      datetimes.block = times.block;
      if (datetimes[0]) {
        date = moment.tz(datetimes[0], tz);
      }
      while (datetimes.length !== 0) {
        datetimes.pop()
      }
      if (mode === 'in') {
        mode = 'none'
      }
    } else if (datetimes.length === 2) {
      if (mode === 'out') {
        Console.error('An out-punch cannot be a range', new Error(original));
        return;
      }
      if (datetimes[1].isBefore(datetimes[0])) {
        datetimes[1] = datetimes[1].add(1, 'days');
      }
      elapsed = calculateElapsed(datetimes[0], datetimes[1], mode, user);
      if (mode === 'in') {
        mode = 'none'
      }
    }

    const [projects, commandWithoutProject] = parseProjects(command, organization);
    command = commandWithoutProject;
    const notes = command.trim();

    const punch = new Punch(mode, datetimes, projects, notes);
    punch.date = datetimes[0] || date || moment.tz(tz);
    punch.timezone = tz;
    if (elapsed) {
      punch.elapsed = elapsed;
    }
    return punch;
  }
  static parseRaw(user: User, row: Rows.RawDataRow, sheet: Sheets.RawDataSheet, projects: Project[] = []) {
    const date = moment.tz(row.today, 'MM/DD/YYYY', TIMEZONE);

    // UUID sanity check
    if (row.id.length != 36) {
      Console.debug(`${row.id} is not a valid UUID, changing to valid UUID`);
      row.id = uuid.v1();
      sheet.saveRow(row);
    }

    let mode;
    if (row.project1 === 'vacation' || row.project1 === 'sick' || row.project1 === 'unpaid') {
      mode = row.project1;
    } else if (row.in && !row.out) {
      mode = 'in';
    } else if (row.out && row.totalTime) {
      mode = 'out';
    } else {
      mode = 'none';
    }

    const datetimes: PunchTime = [];
    const tz = user.timetable.timezone.name;
    for (var i = 0; i < 2; i++) {
      const rawPunchTime = row[MODES[i]];
      if (row[MODES[i]]) {
        let newDate = moment.tz(rawPunchTime, 'MM/DD/YYYY hh:mm:ss a', TIMEZONE);
        if (!newDate || !newDate.isValid()) {
          const timePiece = moment.tz(rawPunchTime, 'hh:mm:ss a', TIMEZONE);
          newDate = moment.tz(`${row.today} ${rawPunchTime}`, 'MM/DD/YYYY hh:mm:ss a', TIMEZONE);
        }
        datetimes.push(newDate.tz(tz));
      }
    }
    let rawElapsed: number;
    let elapsed: number;
    if (row.totalTime) {
      const comps = row.totalTime.split(':');
      rawElapsed = 0;
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        if (isNaN(+comp)) {
          continue;
        } else {
          const compInt = parseInt(comp);
          rawElapsed += +(compInt / (60 ** i)).toFixed(2);
        }
      }
      if (isNaN(rawElapsed)) {
        rawElapsed = 0;
      }
    }

    if (row.blockTime) {
      const comps = row.blockTime.split(':');
      const block = parseInt(comps[0]) + (parseFloat(comps[1]) / 60);
      datetimes.block = block;
    } else if (datetimes.length === 2) {
      if (datetimes[1].isBefore(datetimes[0])) {
        datetimes[1].add(1, 'days');
      }
      elapsed = calculateElapsed(datetimes[0], datetimes[1], mode, user)
      if (elapsed < 0) {
        Console.error('Invalid punch row: elapsed time is less than 0', new Error(datetimes.toString()));
        return;
      } else if (elapsed !== rawElapsed && (rawElapsed == null || Math.abs(elapsed - rawElapsed) > 0.02)) {
        Console.debug(`${row.id} - Updating totalTime because ${elapsed} is not ${rawElapsed} - ${Math.abs(elapsed - rawElapsed)}`);
        const hours = Math.floor(elapsed);
        const minutes = Math.round((elapsed - hours) * 60);
        const minute_str = minutes < 10 ? `0${minutes}` : minutes;
        row.totalTime = `${hours}:${minute_str}:00.000`;
        sheet.saveRow(row).catch((err) => Console.error('Unable to save row', new Error(err)));
      }
    }

    const foundProjects = []
    for (let i = 1; i <= 6; i++) {
      const projectStr = row['project' + i];
      if (!projectStr) {
        break;
      } else if (projectStr === 'vacation' || projectStr === 'sick' || projectStr === 'unpaid') {
        break;
      } else {
        let project = projects.filter((item, index, arr) => `#${item.name}` === projectStr || item.name === projectStr)[0];
        // if (organization.ready() && projects.length === 0) {
        //   project = organization.getProjectByName(projectStr);
        // } else if (projects.length > 0) {
        if (project) {
          foundProjects.push(project);
          continue;
        } else {
          break;
        }
      }
    }

    const notes = row.notes;
    const punch = new Punch(mode, datetimes, foundProjects, notes);
    punch.date = date;
    punch.timezone = tz;
    if (elapsed) {
      punch.elapsed = elapsed;
    }
    punch.assignRow(row);
    return punch;
  }
  appendProjects(organization: Organization, projects: string[] | Project[] = []) {
    const extraProjectCount = this.projects.length;
    if (extraProjectCount >= 6) {
      return;
    }
    for (let project of projects) {
      if (this.projects.length > 6) {
        return;
      }
      let projectName: string;
      if (typeof project === 'string') {
        projectName = project;
        project = organization.getProjectByName(projectName);
      } else {
        projectName = project.name;
      }

      if (!project) {
        continue;
      } else if (this.projects.indexOf(project) === -1) {
        this.projects.push(project);
      }
    }
  }
  appendNotes(notes: string = '') {
    if (this.notes && this.notes.length > 0) {
      this.notes += ', ';
    }
    this.notes += notes;
  }
  out(punch: Punch, organization: Organization) {
    if (this.mode === 'out') {
      return;
    }
    if (!this.times.block && this.mode === 'in' && this.times.length === 1) {
      let newTime: moment.Moment;
      if (punch.times.block) {
        newTime = moment.tz(this.times[0], this.timezone).add(punch.times.block, 'hours');
      } else {
        newTime = moment.tz(punch.times[0], punch.timezone);
        if (newTime.isBefore(this.times[0])) {
          newTime.add(1, 'days');
        }
      }
      this.elapsed = calculateElapsed(this.times[0], newTime, 'out');
      this.times.push(newTime);
    }
    if (punch.projects) {
      this.appendProjects(organization, punch.projects);
    }
    if (punch.notes) {
      this.appendNotes(punch.notes);
    }
    this.mode = punch.mode;
  }
  toRawRow(name: string) {
    const today = moment.tz(TIMEZONE);
    const row = this.row || Rows.RawDataRow.create({
      values: [],
      range: ''
    });
    row.id = row.id || uuid.v1();
    row.today = row.today || this.date.format('MM/DD/YYYY');
    row.name = row.name || name;
    if (this.times.block) {
      const block = this.times.block;
      const hours = Math.floor(block);
      const minutes = Math.round((block - hours) * 60);
      const minute_str = minutes < 10 ? `0${minutes}` : minutes;
      row.blockTime = `${hours}:${minute_str}:00.000`;
    } else {
      for (let i = 0; i < 2; i++) {
        let time;
        if (time = this.times[i]) {
          row[MODES[i]] = time.tz(TIMEZONE).format('MM/DD/YYYY hh:mm:ss A');
        } else {
          row[MODES[i]] = '';
        }
      }
      if (this.elapsed) {
        const hours = Math.floor(this.elapsed);
        const minutes = Math.round((this.elapsed - hours) * 60);
        const minute_str = minutes < 10 ? `0${minutes}` : minutes;
        row.totalTime = `${hours}:${minute_str}:00.000`;
      }
    }
    row.notes = this.notes;
    if (this.mode === 'vacation' || this.mode === 'sick' || this.mode === 'unpaid') {
      row.project1 = this.mode;
    } else {
      const max = this.projects.length < 6 ? this.projects.length : 5;
      for (let i = 0; i <= max; i++) {
        const project = this.projects[i];
        if (project) {
          row[`project${i + 1}`] = `#${project.name}`;
        }
      }
    }
    return row;
  }
  assignRow(row: Rows.RawDataRow) {
    this.row = row;
  }
  isValid(user: User): string {
    // fail cases
    let elapsed, date;
    if (this.times.block) {
      elapsed = this.times.block;
    } else if (this.elapsed) {
      elapsed = this.elapsed;
    }
    if (this.times.length === 2) {
      elapsed = this.times[0].diff(this.times[1], 'hours', true);
    } else if (this.times[0]) {
      date = this.times[0];
    }
    if (this.mode === 'none' && !elapsed) {
      return 'This punch is malformed and could not be properly interpreted. If you believe this is a legitimate error, please DM an admin.';
    } else if (this.mode === 'in') {
      // if mode is 'in' and user has not punched out
      let last;
      if (last = user.lastPunch('in')) {
        const time = last.times[0].tz(user.timetable.timezone.name);
        return `You haven't punched out yet. Your last in-punch was at *${time.format('h:mma')} on ${time.format('dddd, MMMM Do')}*.`;
      } else if (this.times) {
        const yesterday = moment().subtract(1, 'days').startOf('day');
        for (let time of this.times) {
          // if mode is 'in' and date is yesterday
          if (time.isSame(yesterday, 'd')) {
            return 'You can\'t punch in for yesterday\'s date. This is by design and is meant to keep people on top of their timesheet. If you need to file yesterday\'s hours, use a block-time punch.';
          }
        }
      }
    } else if (this.mode === 'out') {
      let lastIn;
      if (lastIn = user.lastPunch(['in', 'vacation', 'unpaid', 'sick'])) {
        if (!lastIn.notes && lastIn.projects.length === 0 && !this.notes && this.projects.length === 0) {
          return 'You must add either a project or some notes to your punch. You can do this along with your out-punch using this format:\n`ibizan out [either notes or #projects]`';
        } else if (lastIn.times.block) {
          return `You cannot punch out before punching in. Your last out-punch was a *${lastIn.times.block} hour* block punch.`;
        } else {
          return 'ok';
        }
      }
      const last = user.lastPunch('out');
      const time = last.times[1].tz(user.timetable.timezone.name) || last.times[0].tz(user.timetable.timezone.name);
      return `You cannot punch out before punching in. Your last out-punch was at *${time.format('h:mma')} on ${time.format('dddd, MMMM Do')}*.`;
    } else if (this.mode === 'unpaid' && !user.salary) {
      // if mode is 'unpaid' and user is non-salary
      return 'You aren\'t eligible to punch for unpaid time because you\'re designated as non-salary.';
    } else if (this.mode === 'vacation' || this.mode === 'sick' || this.mode === 'unpaid') {
      const last = user.lastPunch('in');
      if (last && !this.times.block) {
        const time = last.times[0].tz(user.timetable.timezone.name);
        return `You haven't punched out yet. Your last in-punch was at *${time.format('h:mma')} on ${time.format('dddd, MMMM Do')}*.`;
      }
      if (elapsed) {
        // if mode is 'vacation' and user doesn't have enough vacation time
        const elapsedDays = user.toDays(elapsed);
        if (this.mode === 'vacation' && user.timetable.vacationAvailable < elapsedDays) {
          return `This punch exceeds your remaining vacation time. You\'re trying to add *${elapsedDays} days* worth of vacation time but you only have *${user.timetable.vacationAvailable} days* left.`;
        } else if (this.mode === 'sick' && user.timetable.sickAvailable < elapsedDays) {
          // if mode is 'sick' and user doesn't have enough sick time
          return `This punch exceeds your remaining sick time. You\'re trying to add *${elapsedDays} days* worth of sick time but you only have *${user.timetable.sickAvailable} days* left.`;
        }
        // if mode is 'vacation' and time isn't divisible by 4
        // if mode is 'sick' and time isn't divisible by 4
        // if mode is 'unpaid' and time isn't divisible by 4
        // else if elapsed % 4 isnt 0
        //   return 'This punch duration is not divisible by 4 hours.'
      } else {
        // a vacation/sick/unpaid punch must be a range
        return `A ${this.mode} punch needs to either be a range or a block of time.`;
      }
    } else if (date && moment().diff(date, 'days') >= 7) {
      // if date is more than 7 days from today
      return 'You cannot punch for a date older than 7 days. If you want to enter a punch this old, you\'re going to have to enter it manually on the Ibizan spreadsheet and run `/sync`.';
    }
    return 'ok';
  }
  slackAttachment() {
    const fields = [];
    let color = '#33BB33';
    let elapsed = '', punchDate = '';
    if (this.times.block) {
      elapsed = `${this.times.block} hours on `;
    } else if (this.elapsed) {
      elapsed = `${this.elapsed} hours on `;
    }
    if (this.mode === 'vacation' || this.mode === 'sick' || this.mode === 'unpaid') {
      elapsed += ` ${this.mode} hours on `;
    }

    if (this.row && this.row.today) {
      punchDate = moment(this.row.today, "MM/DD/YYYY").format("dddd, MMMM Do YYYY");
    }

    let notes = this.notes || '';
    if (this.projects && this.projects.length > 0) {
      const projects = this.projects.map((el) => `#${el.name}`).join(', ');
      if (notes === '') {
        notes = projects;
      } else {
        notes = projects + "\n" + notes;
      }
    }
    if (this.mode === 'vacation' || this.mode === 'sick') {
      color = '#3333BB';
    } else if (this.mode === 'unpaid') {
      color = '#BB3333';
    } else {
      if (this.times[0]) {
        const inField = {
          title: 'In',
          value: moment.tz(this.times[0], this.timezone).format("h:mm:ss A"),
          short: true
        };
        punchDate = this.times[0].format("dddd, MMMM Do YYYY");
        fields.push(inField);
      }
      if (this.times[1]) {
        const outField = {
          title: 'Out',
          value: moment.tz(this.times[1], this.timezone).format("h:mm:ss A"),
          short: true
        };
        fields.push(outField);
      }
    }

    const attachment = {
      title: elapsed + punchDate,
      text: notes,
      fields,
      color
    };
    return attachment;
  }
  description(user: User, full: boolean = false) {
    let modeQualifier = '',
      timeQualifier = '',
      blockTimeQualifier = '',
      elapsedQualifier = '',
      projectsQualifier = '',
      notesQualifier = '',
      warningQualifier = '';
    let time = this.times.slice(-1)[0];

    let timeStr;
    if (!time) {
      time = this.date;
      timeStr = '';
    } else {
      timeStr = `at ${time.tz(user.timetable.timezone.name).format('h:mma')} `
    }

    let dateQualifier;
    if (time.isSame(moment(), 'day')) {
      dateQualifier = 'today';
    } else if (time.isSame(moment().subtract(1, 'days'), 'day')) {
      dateQualifier = 'yesterday';
    } else {
      dateQualifier = `on ${time.format('MMM Do, YYYY')}`;
    }
    timeQualifier = ` ${timeStr}${dateQualifier}`;

    let article;
    if (this.times.block) {
      const hours = Math.floor(this.times.block);
      let hoursStr = '';
      if (hours !== 0) {
        hoursStr = `${hours} hour`;
      }
      const minutes = Math.round((this.times.block - hours) * 60);
      let minutesStr = '';
      if (minutes !== 0) {
        minutesStr = `${minutes} minute`;
      }
      blockTimeQualifier = `${hoursStr}${hours > 0 && minutes > 0 ? ', ' : ''}${minutesStr}`;
      if (blockTimeQualifier.charAt(0) === '8' || this.times.block === 11 || this.times.block === 18) {
        article = 'an';
      } else {
        article = 'a';
      }
    } else if (this.elapsed) {
      const hours = Math.floor(this.elapsed);
      let hoursStr = '';
      if (hours === 1) {
        hoursStr = `${hours} hour`;
      } else if (hours > 1) {
        hoursStr = `${hours} hours`;
      }
      const minutes = Math.round((this.elapsed - hours) * 60);
      let minutesStr = '';
      if (minutes === 1) {
        minutesStr = `${minutes} minute`;
      } else if (minutes > 1) {
        minutesStr = `${minutes} minutes`;
      }
      elapsedQualifier = ` (${hoursStr}${hours > 0 && minutes > 0 ? ', ' : ''}${minutesStr})`
    }
    if (this.mode === 'vacation' || this.mode === 'sick' || this.mode === 'unpaid') {
      if (blockTimeQualifier) {
        modeQualifier = `for ${article} ${blockTimeQualifier} ${this.mode} block`;
      } else {
        modeQualifier = `for ${this.mode}`;
      }
    } else if (this.mode === 'none' && blockTimeQualifier) {
      modeQualifier = `for ${article} ${blockTimeQualifier} block`;
    } else {
      modeQualifier = this.mode;
    }
    if (this.projects && this.projects.length > 0) {
      projectsQualifier = ' (';
      projectsQualifier += this.projects.map((el) => `#${el.name}`).join(', ');
    }
    let warnings;
    if (this.notes) {
      if (projectsQualifier) {
        notesQualifier = `, '${this.notes}')`;
      } else {
        notesQualifier = ` ('${this.notes}')`;
      }
      const words = this.notes.split(' ');
      warnings = {
        projects: [],
        other: []
      };
      for (let word of words) {
        if (word.charAt(0) === '#') {
          warnings.projects.push(word);
        }
      }
    } else {
      if (projectsQualifier) {
        notesQualifier = ')';
      }
    }
    if (warnings) {
      for (let warning of warnings.projects) {
        warningQualifier += ` (Warning: ${warning} isn't a registered project. It is stored in this punch's notes rather than as a project.)`;
      }
      for (let warning of warnings.other) {
        warningQualifier += ` (Warning: ${warning} isn't a recognized input. This is stored this punch's notes.)`;
      }
    }
    let description;
    if (full) {
      description = `${modeQualifier}${timeQualifier}${elapsedQualifier}${projectsQualifier}${notesQualifier}${warningQualifier}`;
    } else {
      description = `${modeQualifier}${timeQualifier}${elapsedQualifier}`;
    }
    return description;
  }
}