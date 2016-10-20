
import * as moment from 'moment';

import { HEADERS } from '../helpers/constants';
import logger from '../helpers/logger';
const Logger = logger();
import Calendar, { CalendarEvent } from './calendar';
import Spreadsheet from './sheet';
import Project from './project';
import User, { Settings } from './user';

const CONFIG = {
  sheet_id: process.env.SHEET_ID,
  auth: {
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY
  }
};
const NAME = process.env.ORG_NAME;

// Singleton
export namespace Organization {
  let instance: OrganizationInternal = null;

  export function get(id: string) {
    instance = new OrganizationInternal(id);
    return instance;
  }

  class OrganizationInternal {
    name: string;
    spreadsheet: Spreadsheet;
    initTime: any;
    houndFrequency: number;
    users: User[];
    projects: Project[];
    calendar: Calendar;
    clockChannel: string;
    exemptChannels: string[];

    constructor(id?: string) {
      this.name = NAME || 'Bad organization name';
      const sheetId = id || CONFIG.sheet_id;
      if (sheetId) {
        this.spreadsheet = new Spreadsheet(sheetId);
        Logger.fun(`Welcome to ${this.name}!`);
        this.initTime = moment();
        if (this.spreadsheet.sheet) {
          await this.sync();
          Logger.log('Options loaded');
        } else {
          Logger.warn('Sheet not initialized, no spreadsheet ID was provided');
        }
      }
    }
    ready() {
      if (this.spreadsheet) {
        return this.spreadsheet.initialized
      }
      return false;
    }
    async sync(auth) {
      return new Promise((resolve, reject) => {
        this.spreadsheet.authorize(auth || CONFIG.auth)
        .then(this.spreadsheet.loadOptions.bind(this.spreadsheet))
        .then((opts) => {
          if (opts) {
            this.houndFrequency = opts.houndFrequency;
            let old;
            if (this.users) {
              old = this.users.slice(0);
            }
            this.users = opts.users;
            if (old) {
              for (let user of old) {
                let newUser;
                if (newUser = this.getUserBySlackName(user.slack)) {
                  newUser.settings = Settings.fromSettings(user.settings);
                }
              }
            }
            this.calendar = new Calendar(opts.vacation, opts.sick, opts.holidays, opts.payweek, opts.events);
            this.clockChannel = opts.clockChannel;
            this.exemptChannels = opts.exemptChannels;
          }
        })
        .catch((err) => reject(err))
        .then(() => resolve(true));
      });
    }
    getUserBySlackName(name: string, users?: User[]) {
      if (!users) {
        users = this.users;
      }
      if (users) {
        for (let user of users) {
          if (name === user.slack) {
            return user;
          }
        }
      }
      Logger.debug(`User ${name} could not be found`);
    }
    getUserByRealName(name: string, users?: User[]) {
      if (!users) {
        users = this.users;
      }
      if (users) {
        for (let user of users) {
          if (name === user.name) {
            return user;
          }
        }
      }
      Logger.debug(`Person ${name} could not be found`);
    }
    getProjectByName(name: string, projects?: Project[]) {
      if (!projects) {
        projects = this.projects;
      }
      name = name.replace('#', '');
      if (projects) {
        for (let project of projects) {
          if (name === project.name) {
            return project;
          }
        }
      }
      Logger.debug(`Project ${name} could not be found`);
    }
    async addEvent(date: any, name: string) {
      return new Promise((resolve, reject) => {
        date = moment(date, 'MM/DD/YYYY');
        if (!date.isValid()) {
          reject('Invalid date given to addEvent');
        } else if (!name || name.length === 0) {
          reject('Invalid name given to addEvent');
        }
        const calendarEvent = new CalendarEvent(date, name);
        const calendar = this.calendar;
        this.spreadsheet.addEventRow(calendarEvent.toEventRow())
        .then(() => {
          calendar.events.push(calendarEvent);
          resolve(calendarEvent);
        })
        .catch((err) => {
          reject(`Could not add event row: ${err}`);
        });
      });
    }
    async generateReport(start: any, end: any, send: boolean = false) {
      return new Promise((resolve, reject) => {
        if (!this.spreadsheet) {
          reject('No spreadsheet is loaded, report cannot be generated');
          return;
        } else if (!start || !end) {
          reject('No start or end date were passed as arguments');
          return;
        }
        Logger.log(`Generating payroll from ${start.format('MMM Do, YYYY')} to ${end.format('MMM Do, YYYY')}`);
        
        const headers = HEADERS.payrollreports;
        const reports = [];

        for (let user of this.users) {
          const row = user.toRawPayroll(start, end);
          if (row) {
            reports.push(row);
          }
        }
        reports.sort((left, right) => {
          if (left[headers.logged] < right[headers.logged] || left[headers.vacation] < left[headers.vacation] || left[headers.sick] < left[headers.sick] || left[headers.unpaid] < left[headers.unpaid]) {
            return -1;
          } else if (left[headers.logged] > right[headers.logged] || left[headers.vacation] > left[headers.vacation] || left[headers.sick] > left[headers.sick] || left[headers.unpaid] > left[headers.unpaid]) {
            return 1;
          }
          return 0;
        });
        if (send) {
          this.spreadsheet.generateReport(reports)
          .then((numberDone) => resolve(reports));
        } else {
          resolve(reports);
        }
      });
    }
    dailyReport(reports: any, today: any, yesterday: any) {
      const PAYROLL = HEADERS.payrollreports;
      let response = `DAILY WORK LOG: *${yesterday.format('dddd MMMM D YYYY').toUpperCase()}*\n`;
      let logBuffer = '';
      let offBuffer = '';

      for (let report of reports) {
        let recorded = false;
        if (report[PAYROLL.logged] > 0) {
          let status = `${report.extra.slack}:\t\t\t${report[PAYROLL.logged]} hours`;
          let notes = report.extra.notes;
          if (notes) {
            notes = notes.replace('\n', '; ');
            status += ` "${notes}"`;
          }
          let projectStr = '';
          const projects = report.extra.projects;
          if (projects && projects.length > 0) {
            for (let project of projects) {
              projectStr += `#${project.name} `;
            }
          }
          if (projectStr) {
            projectStr = projectStr.trim();
            status += ` ${projectStr}`;
          }
          status += '\n';
          logBuffer += '${status}';
          recorded = true;
        }
        if (report[PAYROLL.vacation] > 0) {
          offBuffer += `${report.extra.slack}:\t${report[PAYROLL.vacation]} hours vacation\n`
          recorded = true
        }
        if (report[PAYROLL.sick] > 0) {
          offBuffer += `${report.extra.slack}:\t${report[PAYROLL.sick]} hours sick\n`
          recorded = true
        }
        if (report[PAYROLL.unpaid] > 0) {
          offBuffer += `${report.extra.slack}:\t${report[PAYROLL.unpaid]} hours unpaid\n`
          recorded = true
        }
        if (!recorded) {
          offBuffer += "#{report.extra.slack}:\t0 hours\n"
        }
      }
      response += logBuffer + "\n"
      if (offBuffer.length > 0) {
        response += `DAILY OFF-TIME LOG:*${yesterday.format('dddd MMMM D YYYY').toUpperCase()}*\n`;
        response += offBuffer + "\n";
      }
      const upcomingEvents = this.calendar.upcomingEvents();
      if (upcomingEvents.length > 0) {
        const now = moment().subtract(1, 'days');
        response += "\nUPCOMING EVENTS:\n";
        for (let upcomingEvent of upcomingEvents) {
          const days = upcomingEvent.date.diff(now, 'days');
          const weeks = upcomingEvent.date.diff(now, 'weeks');
          let daysArticle = "day";
          if (days > 1) {
            daysArticle += "s"
          }
          let weeksArticle = "week"
          if (weeks > 1) {
            weeksArticle += "s"
          }
          if (weeks > 0) {
            const daysRemainder = days % 7 || 0;
            daysArticle = daysRemainder > 1 ? 'days' : 'day';
            response += "#{upcomingEvent.name} in #{weeks} #{if weeks > 1 then 'weeks' else 'week'}#{if daysRemainder > 0 then ', ' + daysRemainder + ' ' + daysArticle}\n"
          } else {
            response += `*${upcomingEvent.name}* ${days > 1 ? 'in *' + days + ' days*' : '*tomorrow*'}\n`
          }
        }
      }
      return response;
    }
    resetHounding() {
      let i = 0;
      for (let user of this.users) {
        if (user.settings && user.settings.shouldResetHound) {
          user.settings.fromSettings({
            shouldHound: true
          });
        }
        i += 1;
      }
      return i;
    }
    setHoundFrequency(frequency: any) {
      let i = 0;
      for (let user of this.users) {
        user.settings.fromSettings({
          houndFrequency: frequency
        });
        i += 1;
      }
      return i;
    }
    setShouldHound(should: boolean) {
      let i = 0;
      for (let user of this.users) {
        user.settings.fromSettings({
          shouldHound: should
        });
        i += 1;
      }
      return i;
    }
  }
}