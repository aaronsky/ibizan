import * as readline from 'readline';
import * as moment from 'moment';
const google = require('googleapis');
const googleAuth = require('google-auth-library');

import { Rows } from '../shared/rows';
import { momentForHoliday } from '../shared/moment-holiday';
import * as Logger from '../logger';
import { CalendarEvent } from './calendar';
import { Project } from './project';
import { Punch } from './punch';
import { User } from './user';
import { Organization } from './organization';

const SCOPES = [];

export class Spreadsheet {
  service: any;
  auth: any;
  initialized: boolean;
  id: string;
  title: string;

  rawData: any;
  payroll: any;
  variables: any;
  projects: any;
  users: any;
  events: any;

  constructor(sheetId: string) {
    this.service = google.sheets('v4');
    this.initialized = false;
    if (sheetId && sheetId !== 'test') {
      this.id = sheetId;
    }
  }
  async authorize(clientId: string, clientSecret: string, redirectUri: string, token?: string) {
    return new Promise((resolve, reject) => {
      const auth = new googleAuth();
      const oauth2Client = this.auth || new auth.OAuth2(clientId, clientSecret, redirectUri);
      Logger.Console.info('Waiting for authorization');
      if (token) {
        oauth2Client.credentials = token;
        this.auth = oauth2Client;
        Logger.Console.info('Authorized successfully');
        resolve(token);
      } else {
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scopes: SCOPES
        });
        Logger.Console.info('Authorize this app by visiting this url: ', authUrl);
        var rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Enter the code from that page here: ', function (code) {
          rl.close();
          oauth2Client.getToken(code, function (err, token) {
            if (err) {
              console.log('Error while trying to retrieve access token', err);
              reject(err);
            }
            oauth2Client.credentials = token;
            this.auth = oauth2Client;
            Logger.Console.info('Authorized successfully');
            resolve(token);
          });
        });
      }
    });
  }
  async loadOptions() {
    let opts;
    try {
      opts = await this.loadWorksheets();
      opts = await this.loadVariables(opts);
      opts = await this.loadProjects(opts);
      opts = await this.loadEmployees(opts);
      opts = await this.loadEvents(opts);
      opts = await this.loadPunches(opts);
    } catch (err) {
      throw err;
    }
    this.initialized = true;
    return opts;
  }
  async saveRow(row: Rows.Row, sheet: Rows.SheetKind) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await row.save();
        resolve();
      } catch (err) {
        let retry = 1;
        const timeout = setTimeout(async () => {
          if (retry <= 3) {
            Logger.Console.debug(`Retrying save of row in ${sheet}, attempt ${retry}...`);
            try {
              await row.save();
              Logger.Console.debug(`Row was successfully saved to ${sheet} after ${retry} attempts.`);
              clearInterval(timeout);
              resolve();
              return;
            } catch (err) {

            }
            retry += 1;
          } else {
            Logger.Console.error(`Unable to save row to ${sheet}`, new Error(err.toString()));
            reject(err);
          }
        }, 1000);
      }
    });
  }
  async newRow(row: Rows.Row, sheet: Rows.SheetKind) {
    return new Promise((resolve, reject) => {
      const request = {
        spreadsheetId: this.id,
        range: this[sheet].properties.title,
        auth: this.auth,
        insertDataOption: 'INSERT_ROWS',
        resource: row.toGoogleValues()
      };
      this.service.spreadsheets.values.append(request, (err, response) => {
        if (err) {
          let retry = 1;
          const timeout = setTimeout(() => {
            if (retry <= 3) {
              Logger.Console.debug(`Retrying adding row to ${sheet}, attempt ${retry}...`);
              this.service.spreadsheets.values.append(request, (err, response) => {
                if (!err) {
                  Logger.Console.debug(`Row was successfully saved to ${sheet} after ${retry} attempts.`);
                  clearInterval(timeout);
                  resolve(row);
                  return;
                }
              });
              retry += 1;
            } else {
              Logger.Console.error(`Unable to add row to ${sheet}`, new Error(err));
              reject(err);
            }
          }, 1000);
        } else {
          resolve(row);
        }
      });
    });
  }
  rowsFromSheetData<T extends Rows.Row>(rawRows: any[], title: string, ctor: { new (raws: any[], range: string): T; }): T[] {
    return rawRows.reduce((accumulator, row, index, arr) => {
      if (index === 0) {
        return accumulator;
      }
      const newRow = new ctor(row, Rows.Row.formatRowRange(title, index));
      newRow.bindGoogleApis(this.service, this.id, this.auth);
      accumulator.push(newRow);
      return accumulator;
    }, []);
  }
  async enterPunch(punch: Punch, user: User, organization: Organization) {
    let valid;
    if (!punch || !user) {
      throw 'Invalid parameters passed: Punch or user is undefined';
    } else if (valid = punch.isValid(user) && typeof valid === 'string') {
      throw valid;
    }
    return new Promise<Punch>(async (resolve, reject) => {
      if (punch.mode === 'out') {
        if (user.punches && user.punches.length > 0) {
          const len = user.punches.length;
          let last: Punch;
          for (let i = len - 1; i >= 0; i--) {
            last = user.punches[i];
            if (last.mode === 'in') {
              break;
            } else if (last.mode === 'out') {
              continue;
            } else if (last.times.length === 2) {
              continue;
            }
          }
          if (!last) {
            reject('You haven\'t punched out yet.');
          }
          last.out(punch, organization);
          const row = last.toRawRow(user.name);
          row.bindGoogleApis(this.service, this.id, this.auth);
          try {
            await this.saveRow(row, 'rawData');
            // add hours to project in projects
            let elapsed;
            if (last.times.block) {
              elapsed = last.times.block;
            } else {
              elapsed = last.elapsed;
            }
            const logged = user.timetable.loggedTotal;
            user.timetable.loggedTotal = logged + elapsed;
            // calculate project times
            for (let project of last.projects) {
              project.total += elapsed;
              try {
                await project.updateRow();
              } catch (err) {
                reject(err);
              }
            }
            resolve(last);
          } catch (err) {
            reject(err);
          }
        }
      } else {
        const row = punch.toRawRow(user.name);
        try {
          const newRow = await this.newRow(row, 'rawData');
          const title = this.rawData.properties.title;
          const request = {
            spreadsheetId: this.id,
            range: title,
            auth: this.auth,
            dateTimeRenderOption: 'FORMATTED_STRING',
            majorDimension: 'ROWS'
          };
          this.service.spreadsheets.values.get(request, async (err, response) => {
            if (err || !response.values) {
              reject(`Could not get rawData rows: ${err}`);
            }
            const rows = this.rowsFromSheetData<Rows.RawDataRow>(response.values, title, Rows.RawDataRow);
            const rowMatches = rows.filter(r => r.id === row.id);
            const rowMatch = rowMatches[0];
            punch.assignRow(rowMatch);
            user.punches.push(punch);
            if (punch.mode === 'vacation' || punch.mode === 'sick' || punch.mode === 'unpaid') {
              let elapsed;
              if (punch.times.block) {
                elapsed = punch.times.block;
              } else {
                elapsed = punch.elapsed;
              }
              const elapsedDays = user.toDays(elapsed);
              if (punch.mode === 'vacation') {
                const total = user.timetable.vacationTotal;
                const available = user.timetable.vacationAvailable;
                user.timetable.setVacation(total + elapsedDays, available - elapsedDays);
              } else if (punch.mode === 'sick') {
                const total = user.timetable.sickTotal;
                const available = user.timetable.sickAvailable;
                user.timetable.setSick(total + elapsedDays, available - elapsedDays);
              } else if (punch.mode === 'unpaid') {
                const total = user.timetable.unpaidTotal;
                user.timetable.unpaidTotal = total + elapsedDays;
              }
              try {
                await user.updateRow();
              } catch (err) {
                reject(`Could not update user row: ${err}`);
              }
            }
            resolve(punch);
          });
        } catch (err) {
          reject(`Could not add row: ${err}`);
        }
      }
    });
  }
  async generateReport(reports: Rows.PayrollReportsRow[]) {
    let numberDone = 0;
    for (let row of reports) {
      try {
        await this.newRow(row, 'payroll');
        numberDone += 1;
        if (numberDone >= reports.length) {
          return numberDone;
        }
      } catch (err) {
        throw err;
      }
    }
    return numberDone;
  }
  private async loadWorksheets() {
    return new Promise<Options>((resolve, reject) => {
      const request = {
        spreadsheetId: this.id,
        auth: this.auth
      };
      this.service.spreadsheets.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const { properties, sheets } = response;
          this.title = properties.title;
          for (let sheet of sheets) {
            let title = sheet.properties.title;
            const words = title.split(' ');
            title = words[0].toLowerCase();
            for (let i = 1; title.length < 6 && i < words.length; i++) {
              title = title.concat(words[i]);
            }
            if (title === 'employees') {
              title = 'users';
            }
            this[title] = sheet;
          }
          if (!(this.rawData && this.payroll && this.variables && this.projects && this.users && this.events)) {
            reject('Worksheets failed to be associated properly');
          } else {
            Logger.Console.log('silly', '----------------------------------------');
            resolve({} as Options);
          }
        }
      });
    });
  }
  private async loadVariables(opts: Options) {
    return new Promise<Options>((resolve, reject) => {
      const title = this.variables.properties.title;
      const request = {
        spreadsheetId: this.id,
        auth: this.auth,
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS',
        range: title
      };
      this.service.spreadsheets.values.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const rows = this.rowsFromSheetData<Rows.VariablesRow>(response.values, title, Rows.VariablesRow);
          opts = {
            vacation: 0,
            sick: 0,
            houndFrequency: 0,
            payWeek: null,
            holidays: [],
            clockChannel: '',
            exemptChannels: []
          } as Options;
          for (let row of rows) {
            if (row.vacation || +row.vacation === 0) {
              opts.vacation = +row.vacation;
            }
            if (row.sick || +row.sick === 0) {
              opts.sick = +row.sick;
            }
            if (row.houndFrequency || +row.houndFrequency === 0) {
              opts.houndFrequency = +row.houndFrequency;
            }
            if (row.holidays) {
              const name = row.holidays;
              let date;
              if (row.holidayOverride) {
                date = moment(row.holidayOverride, 'MM/DD/YYYY');
              } else {
                date = momentForHoliday(row.holidays);
              }
              opts.holidays.push({ name, date });
            }
            if (row.payweek) {
              opts.payWeek = moment(row.payweek, 'MM/DD/YYYY');
            }
            if (row.clockChannel) {
              opts.clockChannel = row.clockChannel.replace('#', '');
            }
            if (row.exemptChannel) {
              opts.exemptChannels.push(row.exemptChannel.replace('#', ''));
            }
          }
          Logger.Console.log('silly', 'Loaded organization settings');
          Logger.Console.log('silly', '----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadProjects(opts: Options) {
    return new Promise<Options>((resolve, reject) => {
      const title = this.projects.properties.title;
      const request = {
        spreadsheetId: this.id,
        auth: this.auth,
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS',
        range: title
      };
      this.service.spreadsheets.values.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const rows = this.rowsFromSheetData<Rows.ProjectsRow>(response.values, title, Rows.ProjectsRow);
          let projects: Project[] = [];
          for (let row of rows) {
            const project = Project.parse(row);
            if (project) {
              projects.push(project);
            }
          }
          opts.projects = projects;
          Logger.Console.log('silly', `Loaded ${projects.length} projects`);
          Logger.Console.log('silly', '----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadEmployees(opts: Options) {
    return new Promise<Options>((resolve, reject) => {
      const title = this.users.properties.title;
      const request = {
        spreadsheetId: this.id,
        auth: this.auth,
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS',
        range: title
      };
      this.service.spreadsheets.values.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const rows = this.rowsFromSheetData<Rows.UsersRow>(response.values, title, Rows.UsersRow);
          let users: User[] = [];
          for (let row of rows) {
            const user = User.parse(row);
            if (user) {
              users.push(user);
            }
          }
          opts.users = users;
          Logger.Console.log('silly', `Loaded ${users.length} users`);
          Logger.Console.log('silly', '----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadEvents(opts: Options) {
    return new Promise<Options>((resolve, reject) => {
      const title = this.events.properties.title;
      const request = {
        spreadsheetId: this.id,
        auth: this.auth,
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS',
        range: title
      };
      this.service.spreadsheets.values.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const rows = this.rowsFromSheetData<Rows.EventsRow>(response.values, title, Rows.EventsRow);
          let events: CalendarEvent[] = [];
          for (let row of rows) {
            const calendarEvent = CalendarEvent.parse(row);
            if (calendarEvent) {
              events.push(calendarEvent);
            }
          }
          opts.events = events;
          Logger.Console.log('silly', `Loaded ${events.length} calendar events`);
          Logger.Console.log('silly', '----------------------------------------');
          resolve(opts);
        }
      })
    });
  }
  private async loadPunches(opts: Options) {
    return new Promise<Options>((resolve, reject) => {
      const title = this.rawData.properties.title;
      const request = {
        spreadsheetId: this.id,
        auth: this.auth,
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS',
        range: title
      };
      this.service.spreadsheets.values.get(request, (err, response) => {
        if (err) {
          reject(err);
        } else {
          const rows = this.rowsFromSheetData<Rows.RawDataRow>(response.values, title, Rows.RawDataRow);
          rows.forEach((row, index, arr) => {
            const user: User = opts.users.filter((item, index, arr) => item.name === row.name)[0];
            const punch = Punch.parseRaw(user, row, this, opts.projects);
            if (punch && user) {
              user.punches.push(punch);
            }
          });
          Logger.Console.log('silly', `Loaded ${rows.length} punches for ${opts.users.length} users`);
          Logger.Console.log('silly', '----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
}

interface Options {
  vacation: number;
  sick: number;
  houndFrequency: number;
  payWeek: moment.Moment;
  holidays: { 
    name: string;
    date: moment.Moment;
  }[];
  clockChannel: string;
  exemptChannels: string[];
  projects: Project[];
  users: User[];
  events: CalendarEvent[];
  punches: Punch[];
}