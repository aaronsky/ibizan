
import * as moment from 'moment-timezone';
import * as weekend from 'moment-weekend';
import * as uuid from 'node-uuid';

import { HEADERS, MODES, REGEX, TIMEZONE } from '../helpers/constants';
import logger from '../helpers/logger';
const Logger = logger();
import User from './user';
import Project from './project';
import { Organization as Org } from '../models/organization';
const Organization = Org.get();

export default class Punch {
  mode: string;
  times: moment.Moment[];
  projects: Project[];
  notes: string;
  date: moment.Moment;
  timezone: any;
  elapsed?: number;
  row: any;

  constructor(mode: string, times: any[], projects: Project[], notes: string) {
    this.mode = mode;
    this.times = times;
    this.projects = projects;
    this.notes = notes;
  }
  static parse(user: User, command: string, mode: string = 'none', timezone?: any) {
    if (!user) {
      Logger.error('No user passed', new Error(command));
      return;
    } else if (!command) {
      Logger.error('No command passed', new Error(user));
      return;
    }
    if (mode && mode !== 'none') {
      const [mode, commandWithoutMode] = this.parseMode(command);
      command = commandWithoutMode;
    }
    const original = command.slice(0);
    const [start, end] = user.activeHours;
    const tz = timezone || user.timetable.timezone.name;
    const [times, commandWithoutTime] = this.parseTime(command, start, end, timezone);
    command = commandWithoutTime;
    const [dates, commandWithoutDate] = this.parseDate(command);
    command = commandWithoutDate;

    const datetimes = []
    if (dates.length === 0 && times.length === 0) {
      datetimes.push(moment.tz(tz));
    } else if (dates.length > 0 && times.length === 0) {
      datetimes.push(this.mergeDateTime(dates[0], start, tz));
      datetimes.push(this.mergeDateTime(dates[dates.length - 1], end, tz));
    } else if (dates.length === 0 && times.length > 0) {
      for (let time of times) {
        datetimes.push(this.mergeDateTime(moment.tz(tz), time, tz));
      }
    } else {
      if (dates.length === 2 && times.length === 2) {
        datetimes.push(this.mergeDateTime(dates[0], times[0], tz));
        datetimes.push(this.mergeDateTime(dates[1], times[1], tz));
      } else if (dates.length === 2 && times.length === 1) {
        datetimes.push(this.mergeDateTime(dates[0], times[0], tz));
        datetimes.push(this.mergeDateTime(dates[1], times[0], tz));
      } else if (dates.length === 1 && times.length === 2) {
        datetimes.push(this.mergeDateTime(dates[0], times[0], tz));
        datetimes.push(this.mergeDateTime(dates[0], times[1], tz));
      } else {
        datetimes.push(this.mergeDateTime(dates[0], times[0], tz));
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
        Logger.error ('An out-punch cannot be a range', new Error(original));
        return;
      }
      if (datetimes[1].isBefore(datetimes[0])) {
        datetimes[1] = datetimes[1].add(1, 'days');
      }
      elapsed = this.calculateElapsed(datetimes[0], datetimes[1], mode, user);
      if (mode === 'in') {
        mode = 'none'
      }
    }

    const [projects, commandWithoutProject] = this.parseProjects(command);
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
  static parseRaw(user: User, row: any, projects: Project[] = []) {
    if (!user) {
      return;
    } else if (!row) {
      return;
    } else if (!row.save || !row.del) {
      return;
    }
    const headers = HEADERS.rawdata;
    const date = moment.tz(row[headers.today], 'MM/DD/YYYY', TIMEZONE);

    // UUID sanity check
    if (row[headers.id].length != 36) {
      Logger.debug(`${row[headers.id]} is not a valid UUID, changing to valid UUID`);
      row[headers.id] = uuid.v1();
      Organization.spreadsheet.saveRow(row);
    }

    let mode;
    if (row[headers.project1] === 'vacation' || row[headers.project1] === 'sick' || row[headers.project1] === 'unpaid') {
      mode = row[headers.project1];
    } else if (row[headers.in] && !row[headers.out]) {
      mode = 'in';
    } else if (row[headers.out] && row[headers.totalTime]) {
      mode = 'out';
    } else {
      mode = 'none';
    }
    const datetimes: moment.Moment[] = [];
    const tz = user.timetable.timezone.name;
    for (var i = 0; i < 2; i++) {
      if (row[headers[MODES[i]]]) {
        let newDate = moment.tz(row[headers[MODES[i]]], 'MM/DD/YYYY hh:mm:ss a', TIMEZONE);
        if (!newDate || !newDate.isValid()) {
          const timePiece = moment.tz(row[headers[MODES[i]]], 'hh:mm:ss a', TIMEZONE);
          newDate = moment.tz(`${row[headers.today]} ${row[headers[MODES[i]]]}`, 'MM/DD/YYYY hh:mm:ss a', TIMEZONE);
        }
        datetimes.push(newDate.tz(tz));
      }
    }
    let rawElapsed;
    if (row[headers.totalTime]) {
      const comps = row[headers.totalTime].split(':');
      rawElapsed = 0;
      for (let i in comps) {
        const comp = comps[i];
        if (isNaN(comp)) {
          continue;
        } else {
          const compInt = parseInt(comp);
          rawElapsed += +(compInt / Math.pow(60, i).toFixed(2));
        } 
      }
      if (isNaN(rawElapsed)) {
        rawElapsed = 0;
      }
    }
    if (row[headers.blockTime]) {
      const comps = row[headers.blockTime].split(':');
      const block = parseInt(comps[0]) + (parseFloat(comps[1]) / 60);
      datetimes.block = block;
    } else if (datetimes.length === 2) {
      if (datetimes[1].isBefore(datetimes[0])) {
        datetimes[1].add(1, 'days');
      }
      const elapsed = this.calculateElapsed(datetimes[0], datetimes[1], mode, user)
      if (elapsed < 0) {
        Logger.error('Invalid punch row: elapsed time is less than 0', new Error(datetimes));
        return;
      } else if (elapsed !== rawElapsed && (rawElapsed == null || Math.abs(elapsed - rawElapsed) > 0.02)) {
        Logger.debug(`${row[headers.id]} - Updating totalTime because ${elapsed} is not ${rawElapsed} - ${Math.abs(elapsed - rawElapsed)}`);
        const hours = Math.floor(elapsed);
        const minutes = Math.round((elapsed - hours) * 60);
        const minute_str = minutes < 10 ? `0${minutes}` : minutes;
        row[headers.totalTime] = `${hours}:${minute_str}:00.000`;
        Organization.spreadsheet.saveRow(row)
        .catch((err) => Logger.error('Unable to save row', new Error(err)));
      }
    }

    const foundProjects = []
    for (let i = 1; i < 7; i++) {
      const projectStr = row[headers['project' + i]];
      if (!projectStr) {
        break;
      } else if (projectStr === 'vacation' || projectStr === 'sick' || projectStr === 'unpaid') {
        break;
      } else {
        let project;
        if (Organization.ready() && projects.length === 0) {
          project = Organization.getProjectByName(projectStr);
        } else if (projects.length > 0) {
          project = projects.filter((item, index, arr) => `#${item.name}` === projectStr || item.name === projectStr)[0];
        }
        if (project) {
          foundProjects.push(project);
          continue;
        } else {
          break;
        }
      }
    }

    const notes = row[headers.notes];
    const punch = new Punch(mode, datetimes, foundProjects, notes);
    punch.date = date;
    punch.timezone = tz;
    if (elapsed) {
      punch.elapsed = elapsed;
    }
    punch.assignRow(row);
    return punch;
  }
  appendProjects(projects: string[] = []) {
    const extraProjectCount = this.projects.length;
    if (extraProjectCount >= 6) {
      return;
    }
    for (let projectStr of projects) {
      if (this.projects.length > 6) {
        return;
      }
      let project;
      if (project.charAt(0) === '#') {
        project = Organization.getProjectByName(project);
      } else {
        project = Organization.getProjectByName(`#${project}`);
      }
      if (!project) {
        continue;
      } else if (this.projects.indexOf(project) === -1) {
        this.projects.push(project);
      }
    }
    return projects.join(' ');
  }
  appendNotes(notes: string = '') {
    if (this.notes && this.notes.length > 0) {
      this.notes += ', ';
    }
    this.notes += notes;
  }
  out(punch: Punch) {
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
      this.elapsed = this.calculateElapsed(this.times[0], newTime, 'out');
      this.times.push(newTime);
    }
    if (punch.projects) {
      this.appendProjects(punch.projects);
    }
    if (punch.notes) {
      this.appendNotes(punch.notes);
    }
    this.mode = punch.mode;
  }
  toRawRow(name: string) {
    const headers = HEADERS.rawdata;
    const today = moment.tz(TIMEZONE);
    const row = this.row || {};
    row[headers.id] = row[headers.id] || uuid.v1();
    row[headers.today] = row[headers.today] || this.date.format('MM/DD/YYYY');
    row[headers.name] = row[headers.name] || name;
    if (this.times.block) {
      const block = this.times.block;
      const hours = Math.floor(block);
      const minutes = Math.round((block - hours) * 60);
      const minute_str = minutes < 10 ? `0${minutes}` : minutes;
      row[headers.blockTime] = `${hours}:${minute_str}:00.000`;
    } else {
      for (let i = 0; i < 2; i++) {
        let time;
        if (time = this.times[i]) {
          row[headers[MODES[i]]] = time.tz(TIMEZONE).format('MM/DD/YYYY hh:mm:ss A');
        } else {
          row[headers[MODES[i]]] = '';
        }
      }
      if (this.elapsed) {
        const hours = Math.floor(this.elapsed);
        const minutes = Math.round((this.elapsed - hours) * 60);
        const minute_str = minutes < 10 ? `0${minutes}` : minutes;
        row[headers.totalTime] = `${hours}:${minute_str}:00.000`;
      }
    }
    row[headers.notes] = this.notes;
    if (this.mode === 'vacation' || this.mode === 'sick' || this.mode === 'unpaid') {
      row[headers.project1] = this.mode;
    } else {
      const max = this.projects.length < 6 ? this.projects.length : 5;
      for (let i = 0; i <= max; i++) {
        const project = this.projects[i];
        if (project) {
          row[headers[`project${i + 1}`]] = `#${project.name}`;
        }
      }
    }
    return row;
  }
  assignRow(row: ISheetRow) {
    this.row = row;
  }
  isValid(user: User) {
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
      if (lastIn = user.lastPunch('in')) {
        if (!lastIn.notes && lastIn.projects.length === 0 && !this.notes && this.projects.length === 0) {
          return 'You must add either a project or some notes to your punch. You can do this along with your out-punch using this format:\n`ibizan out [either notes or #projects]`';
        } else {
          return true;
        }
      }
      const last = user.lastPunch(['out', 'vacation', 'unpaid', 'sick']);
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
    return true;
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

    const headers = HEADERS.rawdata;
    if (this.row && this.row[headers.today]) {
      punchDate = moment(this.row[headers.today], "MM/DD/YYYY").format("dddd, MMMM Do YYYY");
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
    const modeQualifier = timeQualifier = elapsedQualifier = projectsQualifier = notesQualifier = warningQualifier = '';
    const time = this.times.slice(-1)[0];

    let timeStr;
    if (!time) {
      time = this.date;
      timeStr = '';
    } else {
      timeStr = "at #{time?.tz(user.timetable?.timezone?.name).format('h:mma')} "
    }

    let dateQualifier;
    if (time.isSame(moment(), 'day')) {
      dateQualifier = 'today';
    } else if (time.isSame(moment().subtract(1, 'days'), 'day')) {
      dateQualifier = 'yesterday';
    } else {
      dateQualifier = `on ${time.format('MMM Do, YYYY')}`;
    }
    const timeQualifier = ` ${timeStr}${dateQualifier}`;

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
      const blockTimeQualifier = `${hoursStr}${hours > 0 && minutes > 0 ? ', ' : ''}${minutesStr}`;
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
      const elapsedQualifier = " (#{hoursStr}#{if hours > 0 and minutes > 0 then ', ' else ''}#{minutesStr})"
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
    if (this.notes) {
      if (projectsQualifier) {
        notesQualifier = `, '${this.notes}')`;
      } else {
        notesQualifier = ` ('${this.notes}')`;
      }
      const words = this.notes.split(' ');
      const warnings = {
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
  private mergeDateTime(date: moment.Moment, time: any, tz: any = TIMEZONE) {
    return moment.tz({
      year: date.get('year'),
      month: date.get('month'),
      date: date.get('date'),
      hour: time.get('hour'),
      minute: time.get('minute'),
      second: time.get('second')
    }, tz);
  }
  private parseMode(command: string) {
    const comps = command.split(' ');
    let [mode, commandWithoutMode] = [comps.shift(), comps.join(' ')];
    mode = (mode || '').toLowerCase().trim()
    commandWithoutMode = (commandWithoutMode || '').trim()
    if (MODES.indexOf(mode) !== -1) {
      return [mode, commandWithoutMode];
    }
    return ['none', commandWithoutMode];
  }
  private parseTime(command: string, activeStart: any, activeEnd: any, tz: any) {
    // parse time component
    command = command.trimLeft() || '';
    if (command.indexOf('at') === 0) {
      command = command.replace('at', '');
      command = command.trimLeft();
    }
    const activeTime = activeEnd.diff(activeStart, 'hours', true).toFixed(2);
    const time = [];
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
        const block_str = match[0].replace('hours', '').replace('hour', '').trimRight();
        const block = parseFloat(block_str);
        time.block = block
      }
      const pattern = new RegExp(match[0] + ' ?', 'i');
      command = command.replace(pattern, '');
    } else if (match = command.match(REGEX.time)) {
      let timeMatch = match[0];
      const now = moment.tz(tz);
      let hourStr;
      if (hourStr = timeMatch.match(/\b((0?[1-9]|1[0-2])|(([0-1][0-9])|(2[0-3]))):/i)) {
        const hour = parseInt(hourStr[0].replace(':', ''));
        if (hour <= 12) {
          if (!timeMatch.match(/(a|p)m?/i)) {
            // Inferred period
            const period = now.format('a');
            timeMatch = "#{timeMatch} #{period}";
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
  private parseDate(command: string) {
    command = command.trimLeft() || '';
    if (command.indexOf('on') === 0) {
      command = command.replace('on', '');
      command = command.trimLeft();
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
    } else if (match = command.match REGEX.days) {
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
          if (!isNaN(str) && month) {
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
  private calculateElapsed(start: any, end: any, mode: string, user: User) {
    let elapsed = end.diff(start, 'hours', true);
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
          const holidayStr = currentDate.holiday();
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
  private parseProjects(command: string) {
    const projects = [];
    command = command.trimLeft() || '';
    if (command.indexOf('in') === 0) {
      command = command.replace('in', '');
      command = command.trimLeft();
    }
    const commandCopy = command.split(' ').slice();
    for (let word of commandCopy) {
      let project;
      if (project = Organization.getProjectByName(word)) {
        projects.push(project);
        const pattern = new RegExp(word + ' ?', 'i');
        command = command.replace(pattern, '');
      }
    }
    return [projects, command];
  }
}