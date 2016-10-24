
import moment from 'moment-timezone';

import { HEADERS, TIMEZONE } from '../shared/constants';
import { holidayForMoment } from '../shared/moment-holiday';
import { Rows } from '../shared/common';
import Logger from '../logger/logger';
import Punch from './punch';

function getPositiveNumber(input?: number, current: number = 0) {
  if (!input) {
    return current;
  }
  if (!isNaN(input)) {
    if (input >= 0) {
      return input;
    }
    return 0;
  }
  return current;
}

export class Timetable {
  private _start: moment.Moment;
  private _end: moment.Moment;
  private _timezone: MomentTimezone;
  vacationTotal: number;
  vacationAvailable: number;
  sickTotal: number;
  sickAvailable: number;
  private _unpaidTotal: number;
  private _loggedTotal: number;
  private _averageLoggedTotal: number;
  holiday: number;

  get start(): moment.Moment {
    return this._start;
  }
  set start(newStart: moment.Moment) {
    this._start = moment.tz(newStart, 'hh:mm a', this.timezone.name);
  }
  get end(): moment.Moment {
    return this._end;
  }
  set end(newEnd) {
    this._end = moment.tz(newEnd, 'hh:mm a', this.timezone.name);
  }
  get timezone(): MomentTimezone {
    return this._timezone;
  }
  set timezone(newTimezone) {
    this.timezone = newTimezone;
    this._start = moment.tz(this._start, 'hh:mm a', this.timezone.name);
    this._end = moment.tz(this._end, 'hh:mm a', this.timezone.name);
  }
  set unpaidTotal(newTotal) {
    this._unpaidTotal = getPositiveNumber(newTotal, this._unpaidTotal);
  }
  set loggedTotal(newTotal) {
    this._loggedTotal = getPositiveNumber(newTotal, this._loggedTotal);
  }
  set averageLogged(newTotal) {
    this._averageLoggedTotal = getPositiveNumber(newTotal, this._averageLoggedTotal);
  }

  constructor(start: string, end: string, timezone) {
    this.timezone = timezone;
    if (typeof this.timezone === 'string') {
      this.timezone = moment.tz.zone(this.timezone);
    }
    this._start = moment.tz(start, 'hh:mm a', this.timezone.name);
    this._end = moment.tz(end, 'hh:mm a', this.timezone.name);
  }
  setVacation(total, available) {
    this.vacationTotal = getPositiveNumber(total, this.vacationTotal);
    this.vacationAvailable = getPositiveNumber(available, this.vacationAvailable);
  }
  setSick(total, available) {
    this.sickTotal = getPositiveNumber(total, this.sickTotal);
    this.sickAvailable = getPositiveNumber(available, this.sickAvailable);
  }
  activeHours(): moment.Moment[] {
    const now = moment.tz(this.timezone.name);
    const start = this.start.year(now.year()).dayOfYear(now.dayOfYear());
    const end = this.end.year(now.year()).dayOfYear(now.dayOfYear());
    return [start, end];
  }
  activeTime(): number {
    const rawTime = +(this.end.diff(this.start, 'hours', true).toFixed(2));
    return Math.min(8, rawTime);
  }
  toDays(hours): number {
    return hours / this.activeTime();
  }
}

interface ILastMessage {
  time: moment.Moment;
  channel: string;
};

export class Settings {
  shouldHound: boolean;
  shouldResetHound: boolean;
  houndFrequency: number;
  lastMessage: ILastMessage;
  lastPing: moment.Moment;

  constructor() {
    this.shouldHound = true
    this.shouldResetHound = true
    this.houndFrequency = -1
    this.lastMessage = null
    this.lastPing = null
  }
  static fromSettings(settings) {
    const newSetting = new Settings();
    newSetting.fromSettings(settings);
    return newSetting;
  }
  fromSettings(opts) {
    if (!opts || typeof opts !== 'object') {
      return;
    }
    for (let setting of opts) {
      const value = opts[setting];
      this[setting] = value;
    }
  }
}

export default class User {
  name: string;
  slack: string;
  salary: boolean;
  timetable: Timetable;
  row: Rows.UsersRow;
  punches: Punch[];
  settings: Settings;
  
  constructor(name: string, slack: string, salary: boolean, timetable: Timetable, row: any = null) {
    this.name = name;
    this.slack = slack;
    this.salary = salary;
    this.timetable = timetable;
    this.row = row;
    this.punches = [];
  }
  static parse(row: Rows.UsersRow) {
    const headers = HEADERS.users;
    const temp: any = {};
    for (let key in headers) {
      const header = headers[key];
      if (header === headers.start || header === headers.end) {
        row[header] = row[header].toLowerCase();
        if (row[header] === 'midnight') {
          row[header] = '12:00 am';
        } else if (row[header] === 'noon') {
          row[header] = '12:00 pm';
        }
        temp[key] = row[header];
      } else if (header === headers.salary) {
        temp[key] = row[header] === 'Y';
      } else if (header === headers.timezone) {
        let zone;
        if (zone = moment.tz.zone(row[header])) {
          temp[key] = zone;
        } else {
          temp[key] = row[header];
        }
      } else if (header === headers.shouldHound) {
        temp[key] = row[header] === 'Y';
      } else if (header === headers.houndFrequency) {
        temp[key] = row[header] || -1;
        if (temp[key] === -1) {
          temp.shouldResetHound = false;
        } else {
          temp.shouldResetHound = true;
        }
      } else if (header === headers.overtime) {
        continue;
      } else if (header === headers.lastPing) {
        let tz = TIMEZONE;
        if (temp.timezone) {
          tz = temp.timezone.name;
        }
        const lastPing = moment.tz(row[header], 'MM/DD/YYYY hh:mm:ss A', tz);
        if (lastPing.isValid()) {
          temp[key] = lastPing;
        } else {
          temp[key] = moment.tz(tz).subtract(1, 'days');
        }
      } else {
        if (isNaN(row[header])) {
          temp[key] = row[header].trim();
        } else {
          temp[key] = parseInt(row[header]);
        }
      }
    }
    const timetable = new Timetable(temp.start, temp.end, temp.timezone);
    timetable.setVacation(temp.vacationLogged, temp.vacationAvailable);
    timetable.setSick(temp.sickLogged, temp.sickAvailable);
    timetable.unpaidTotal = temp.unpaidLogged;
    timetable.loggedTotal = temp.totalLogged;
    timetable.averageLogged = temp.averageLogged;
    const user = new User(temp.name, temp.slackname, temp.salary, timetable, row);
    user.settings = Settings.fromSettings({
      shouldHound: temp.shouldHound,
      shouldResetHound: temp.shouldResetHound,
      houndFrequency: temp.houndFrequency,
      lastMessage: null,
      lastPing: temp.lastPing
    });
    return user;
  }
  get activeHours(): any[] {
    return this.timetable.activeHours();
  }
  get activeTime(): number {
    return this.timetable.activeTime();
  }
  setTimezone(timezone) {
    const tz = moment.tz.zone(timezone);
    if (tz) {
      this.timetable.timezone = tz;
      this.updateRow();
    }
    return tz;
  }
  setStart(start) {
    const time = moment(start, 'h:mm A');
    if (time) {
      this.timetable.start = time;
      this.updateRow();
    }
    return time;
  }
  setEnd(end) {
    const time = moment(end, 'h:mm A');
    if (time) {
      this.timetable.end = time;
      this.updateRow();
    }
    return time;
  }
  toDays(hours) {
    return this.timetable.toDays(hours);
  }
  isInactive(current?: moment.Moment) {
    current = current || moment.tz(this.timetable.timezone.name);
    const [start, end] = this.activeHours;
    if (holidayForMoment(current)) {
      return true;
    } else if (current.isBetween(start, end)) {
      return false;
    } else {
      return true;
    }
  }
  lastPunch(modes?: string | string[]) {
    if (typeof modes === 'string') {
      modes = [modes]
    }
    if (!modes || modes.length === 0) {
      return this.punches.slice(-1)[0]
    }
    if (this.punches && this.punches.length > 0) {
      const len = this.punches.length;
      for (let i = len - 1; i >= 0; --i) {
        const last = this.punches[i];
        if (modes.indexOf('in') !== -1 && modes.indexOf('out') === -1 && last.mode === 'out') {
          return;
        } else if (modes.indexOf(last.mode) !== -1) {
          return last;
        }
      }
    }
    return;
  }
  lastPunchTime() {
    if (this.punches.length > 0) {
      const punch = this.lastPunch();
      if (punch.times.length > 0) {
        const time = punch.times.slice(-1)[0];
        let date;
        if (time.isSame(moment(), 'day')) {
          date = 'today';
        } else if (time.isSame(moment().subtract(1, 'days'), 'day')) {
          date = 'yesterday';
        } else {
          date = 'on ' + time.format('MMM Do');
        }
        return `${date}, ${time.format('h:mm a')}`;
      } else if (punch.times.block) {
        let type;
        if (punch.mode === 'none') {
          type = ' ';
        } else if (punch.mode === 'vacation' || punch.mode === 'sick' || punch.mode === 'unpaid') {
          type = punch.mode + ' ';
        }
        return `a ${punch.times.block} hour ${type}block punch`;
      }
    }
    return 'never';
  }
  async undoPunch() {
    return new Promise((resolve, reject) => {
      const lastPunch = this.lastPunch();
      Logger.Console.log(`Undoing ${this.slack}'s punch: ${lastPunch.description(this)}'`);
      let elapsed;
      if (lastPunch.times.block) {
        elapsed = lastPunch.times.block;
      } else {
        elapsed = lastPunch.elapsed || 0;
      }
      const headers = HEADERS.rawdata;
      if (lastPunch.mode === 'vacation' || lastPunch.mode === 'sick' || lastPunch.mode === 'unpaid' || lastPunch.mode === 'none') {
        lastPunch.row.del(() => {
          const punch = this.punches.pop();
          const elapsedDays = this.toDays(elapsed);
          if (punch.mode === 'vacation') {
            const total = this.timetable.vacationTotal;
            const available = this.timetable.vacationAvailable;
            this.timetable.setVacation(total - elapsedDays, available + elapsedDays);
          } else if (punch.mode === 'sick') {
            const total = this.timetable.sickTotal;
            const available = this.timetable.sickAvailable;
            this.timetable.setSick(total - elapsedDays, available + elapsedDays);
          } else if (punch.mode === 'unpaid') {
            const total = this.timetable.unpaidTotal;
            this.timetable.unpaidTotal = total - elapsedDays;
          } else {
            const logged = this.timetable.loggedTotal;
            this.timetable.loggedTotal = logged - elapsed;
          }
          resolve(punch);
        });
      } else if (lastPunch.mode === 'out') {
        lastPunch.times.pop();
        lastPunch.elapsed = null;
        if (lastPunch.notes.lastIndexOf('\n') > 0) {
          lastPunch.notes = lastPunch.notes.substring(0, lastPunch.notes.lastIndexOf('\n'));
        }
        lastPunch.mode = 'in';
        lastPunch.row[headers.out] = lastPunch.row[headers.totalTime] = lastPunch.row[headers.blockTime] = '';
        lastPunch.row[headers.notes] = lastPunch.notes;
        lastPunch.row.save(() => {
          const logged = this.timetable.loggedTotal;
          this.timetable.loggedTotal = logged - elapsed;
          resolve(lastPunch);
        });
      } else if (lastPunch.mode === 'in') {
        lastPunch.row.del(() => {
          const punch = this.punches.pop();
          resolve(punch);
        });
      }
    });
  }
  toRawPayroll(start, end) {
    const headers = HEADERS.payrollreports;
    let row: Rows.PayrollReportsRow;
    row[headers.date] = moment.tz(TIMEZONE).format('M/DD/YYYY');
    row[headers.name] = this.name;
    let loggedTime = 0, 
        unpaidTime = 0,
        vacationTime = 0,
        sickTime = 0;
    const projectsForPeriod = []
    for (let punch of this.punches) {
      if (punch.date.isBefore(start) || punch.date.isAfter(end)) {
        continue;
      } else if (!punch.elapsed && !punch.times.block) {
        continue;
      } else if (punch.mode === 'in') {
        continue;
      } else if (punch.mode === 'vacation') {
        if (punch.times.block) {
          vacationTime += punch.times.block;
        } else {
          vacationTime += punch.elapsed;
        }
      } else if (punch.mode === 'unpaid') {
        if (punch.times.block) {
          unpaidTime += punch.times.block;
        } else {
          unpaidTime += punch.elapsed;
        }
      } else if (punch.mode === 'sick') {
        if (punch.times.block) {
          sickTime += punch.times.block;
        } else {
          sickTime += punch.elapsed;
        }
      } else {
        if (punch.times.block) {
          loggedTime += punch.times.block;
        } else {
          loggedTime += punch.elapsed;
        }
      }
      if (punch.projects && punch.projects.length > 0) {
        for (let project of punch.projects) {
          const match = projectsForPeriod.filter((item, index, arr) => {
            return project.name === item.name;
          })[0];
          if (!match) {
            projectsForPeriod.push(project);
          }
        }
      }
    }

    loggedTime = +loggedTime.toFixed(2);
    vacationTime = +vacationTime.toFixed(2);
    sickTime = +sickTime.toFixed(2);
    unpaidTime = +unpaidTime.toFixed(2);

    if (this.salary) {
      row[headers.paid] = 80 - unpaidTime;
    } else {
      row[headers.paid] = loggedTime + vacationTime + sickTime;
    }

    row[headers.unpaid] = unpaidTime;
    row[headers.logged] = loggedTime;
    row[headers.vacation] = vacationTime;
    row[headers.sick] = sickTime;
    row[headers.overtime] = Math.max(0, loggedTime - 80);
    row[headers.holiday] = this.timetable.holiday || 0;
    row.extra = {
      slack: this.slack,
      projects: projectsForPeriod
    };
    return row;
  }
  updateRow() {
    return new Promise<boolean>((resolve, reject) => {
      if (this.row) {
        const headers = HEADERS.users;
        this.row[headers.start] = this.timetable.start.format('h:mm A');
        this.row[headers.end] = this.timetable.end.format('h:mm A');
        this.row[headers.timezone] = this.timetable.timezone.name;
        this.row[headers.shouldHound] = this.settings.shouldHound ? 'Y' : 'N';
        this.row[headers.houndFrequency] = this.settings.houndFrequency ? this.settings.houndFrequency : -1;
        this.row[headers.vacationAvailable] = this.timetable.vacationAvailable;
        this.row[headers.vacationLogged] = this.timetable.vacationTotal;
        this.row[headers.sickAvailable] = this.timetable.sickAvailable;
        this.row[headers.sickLogged] = this.timetable.sickTotal;
        this.row[headers.unpaidLogged] = this.timetable.unpaidTotal;
        this.row[headers.overtime] = Math.max(0, this.timetable.loggedTotal - 80);
        this.row[headers.totalLogged] = this.timetable.loggedTotal;
        this.row[headers.averageLogged] = this.timetable.averageLogged;
        if (this.settings.lastPing) {
          this.row[headers.lastPing] = moment.tz(this.settings.lastPing, this.timetable.timezone.name).format('MM/DD/YYYY hh:mm:ss A');
        } else {
          this.row[headers.lastPing] = moment.tz(this.timetable.timezone.name).format('MM/DD/YYYY hh:mm:ss A');
        }
        this.row.save((err) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      } else {
        reject('Row is null');
      }
    });
  }
  directMessage(msg: string, logger = Logger, attachment?: any) {
    logger.Slack.logToChannel(msg, this.slack, attachment, true);
  }
  hound(msg: string, logger = Logger) {
    const now = moment.tz(TIMEZONE);
    this.settings.lastPing = now;
    if (!this.salary && this.settings.houndFrequency > 0) {
      msg = `You have been on the clock for ${this.settings.houndFrequency} hours.\n` + msg;
    }
    setTimeout(() => this.directMessage(msg, logger), 1000 * (Math.floor(Math.random() * 3) + 1));
    Logger.Console.log(`Hounded ${this.slack} with '${msg}'`);
    this.updateRow();
  }
  hexColor() {
    let hash = 0;
    for (let i = 0, len = this.slack.length; i < len; i++) {
      hash = this.slack.charCodeAt(i) + ((hash << 3) - hash);
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    const hexColor = "#" + '000000'.substring(0, 6 - color.length) + color;
    return hexColor;
  }
  slackAttachment() {
    const fields = [];
    const statusString = `${this.salary ? 'Salary' : 'Hourly'} - Active ${this.timetable.start.format('h:mm a')} to ${this.timetable.end.format('h:mm a z')}`;
    const lastPunch = this.lastPunch();
    if (lastPunch) {
      const lastPunchField = {
        title: 'Last Punch',
        value: `${lastPunch.description(this)}`,
        short: true
      };
      fields.push(lastPunchField);
    }
    let houndString = `${this.settings.shouldHound ? 'On' : 'Off'}`;
    if (this.settings.shouldHound) {
      houndString += ` (${this.settings.houndFrequency} hours)`
    }
    const houndField = {
      title: "Hounding",
      value: houndString,
      short: true
    };
    fields.push(houndField);
    if (this.salary) {
      const vacationDaysField = {
        title: "Vacation Days",
        value: `${this.timetable.vacationAvailable} available, ${this.timetable.vacationTotal} used`,
        short: true
      };
      fields.push(vacationDaysField)
      const sickDaysField = {
        title: "Sick Days",
        value: `${this.timetable.sickAvailable} available, ${this.timetable.sickTotal} used`,
        short: true
      };
      fields.push(sickDaysField)
    }
    if (this.timetable.unpaidTotal > 0) {
      const unpaidField = {
        title: "Unpaid Days",
        value: `${this.timetable.unpaidTotal} used`,
        short: true
      };
      fields.push(unpaidField);
    }
    const attachment = {
      title: this.name + ' (@' + this.slack + ')',
      text: statusString,
      fallback: this.name.replace(/\W/g, '') + ' @' + this.slack.replace(/\W/g, ''),
      color: this.hexColor(),
      fields
    };
    return attachment;
  }
  description() {
    return `User: ${this.name} (${this.slack})\nThey have ${(this.punches || []).length} punches on record\nLast punch was ${this.lastPunchTime()}\nTheir active hours are from ${this.timetable.start.format('h:mm a')} to ${this.timetable.end.format('h:mm a')}\nThey are in ${this.timetable.timezone.name}\nThe last time they sent a message was ${+(moment.tz(TIMEZONE).diff(this.settings.lastMessage.time, 'hours', true).toFixed(2))} hours ago`;
  }
}