import * as fs from 'fs';
import * as path from 'path';

import * as moment from 'moment';
const google = require('googleapis');
const googleAuth = require('google-auth-library');

import { momentForHoliday } from '../shared/moment-holiday';
import { Console } from '../logger';
import { CalendarEvent } from './calendar';
import { Organization } from './organization';
import { Project } from './project';
import { Punch } from './punch';
import { Rows } from './rows';
import { User } from './user';

interface SheetOptions {
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

export namespace Sheets {
  export abstract class Sheet<T extends Rows.Row> {
    parent: Worksheet;
    sheet: any;

    constructor(parent: Worksheet, sheet: any) {
      this.parent = parent;
      this.sheet = sheet;
    }

    abstract async load(opts: SheetOptions): Promise<SheetOptions>;

    rowsFromSheetData<T>(rawRows: any[], title: string, rowKind: {
      create({ values, range, service, sheetId, authClient }:
        { values: any[], range: string, service?: any, sheetId?: string, authClient?: any }): T;
    }): T[] {
      return rawRows.slice(1).map((row, index) => {
        /*
         * We have to offset the row's index by 2 because Google Sheets are 1-indexed, 
         * and we're shaving off the first row. Therefore, the first row we iterate on will 
         * be row 2 in the sheet, but row 0 in this list because we omit the header row.
         * In order to retain the proper sheet range, we add 2 to our current index.
         */
        const newIndex = index + 2;
        return rowKind.create({
          values: row,
          range: Rows.Row.formatRowRange(title, newIndex),
          service: this.parent.service,
          sheetId: this.parent.id,
          authClient: this.parent.auth
        });
      });
    }

    async saveRow(row: T) {
      return new Promise<void>(async (resolve, reject) => {
        try {
          await row.save();
          resolve();
        } catch (err) {
          let retry = 1;
          const timeout = setTimeout(async () => {
            if (retry <= 3) {
              Console.debug(`Retrying save of row in ${this.sheet.properties.title}, attempt ${retry}...`);
              try {
                await row.save();
                Console.debug(`Row was successfully saved to ${this.sheet.properties.title} after ${retry} attempts.`);
                clearInterval(timeout);
                resolve();
                return;
              } catch (err) {

              }
              retry += 1;
            } else {
              Console.error(`Unable to save row to ${this.sheet.properties.title}`, new Error(err.toString()));
              clearInterval(timeout);
              reject(err);
            }
          }, 1000);
        }
      });
    }

    async appendNewRow(row: T) {
      const request = {
        spreadsheetId: this.parent.id,
        range: this.sheet.properties.title,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        auth: this.parent.auth,
        resource: row.toGoogleValues()
      };
      return new Promise((resolve, reject) => {
        this.parent.service.spreadsheets.values.append(request, (err, response) => {
          if (err) {
            let retry = 1;
            const timeout = setTimeout(() => {
              if (retry <= 3) {
                Console.debug(`Retrying adding row to ${this.sheet.properties.title}, attempt ${retry}...`);
                this.parent.service.spreadsheets.values.append(request, (err, response) => {
                  if (!err) {
                    Console.debug(`Row was successfully saved to ${this.sheet.properties.title} after ${retry} attempts.`);
                    clearInterval(timeout);
                    resolve(row);
                    return;
                  }
                });
                retry += 1;
              } else {
                Console.error(`Unable to add row to ${this.sheet.properties.title}`, new Error(err));
                clearInterval(timeout);
                reject(err);
              }
            }, 1000);
          }
          resolve(row);
        });
      });
    }
  }

  export class PayrollSheet extends Sheet<Rows.PayrollReportsRow> {
    static title: string = 'Payroll Reports';
    static kind: Rows.SheetKind = 'payroll';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return opts;
    }

    async generateReport(reports: Rows.PayrollReportsRow[]) {
      let numberDone = 0;
      for (let row of reports) {
        try {
          await this.appendNewRow(row);
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
  }

  export class ProjectsSheet extends Sheet<Rows.ProjectsRow> {
    static title: string = 'Projects';
    static kind: Rows.SheetKind = 'projects';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return new Promise<SheetOptions>((resolve, reject) => {
        const request = {
          spreadsheetId: this.parent.id,
          auth: this.parent.auth,
          dateTimeRenderOption: 'FORMATTED_STRING',
          majorDimension: 'ROWS',
          range: ProjectsSheet.title
        };
        this.parent.service.spreadsheets.values.get(request, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          const rows = this.rowsFromSheetData<Rows.ProjectsRow>(response.values, ProjectsSheet.title, Rows.ProjectsRow);
          opts.projects = rows.reduce((acc, row) => [...acc, Project.parse(row)], []);
          Console.silly(`Loaded ${opts.projects.length} projects`);
          Console.silly('----------------------------------------');
          resolve(opts);
        });
      });
    }
  }

  export class RawDataSheet extends Sheet<Rows.RawDataRow> {
    static title: string = 'Raw Data';
    static kind: Rows.SheetKind = 'rawData';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return new Promise<SheetOptions>((resolve, reject) => {
        const request = {
          spreadsheetId: this.parent.id,
          auth: this.parent.auth,
          dateTimeRenderOption: 'FORMATTED_STRING',
          majorDimension: 'ROWS',
          range: RawDataSheet.title
        };
        this.parent.service.spreadsheets.values.get(request, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          const rows = this.rowsFromSheetData<Rows.RawDataRow>(response.values, RawDataSheet.title, Rows.RawDataRow);
          rows.forEach((row, index, arr) => {
            const user: User = opts.users.filter((item, index, arr) => item.realName === row.name)[0];
            const punch = Punch.parseRaw(user, row, this, opts.projects);
            if (punch && user) {
              user.punches.push(punch);
            }
          });
          Console.silly(`Loaded ${rows.length} punches for ${opts.users.length} users`);
          Console.silly('----------------------------------------');
          resolve(opts);
        });
      });
    }

    async enterPunch(punch: Punch, user: User, organization: Organization) {
      if (!punch || !user) {
        throw new Error('Invalid parameters passed: Punch or user is undefined');
      }
      const valid = punch.isValid(user);
      if (valid && valid !== 'ok') {
        throw new Error(valid);
      }

      return new Promise<Punch>(async (resolve, reject) => {
        if (punch.mode === 'out' && user.punches && user.punches.length > 0) {
          let last = user.lastPunch('in');
          if (!last) {
            reject('You haven\'t punched in yet.');
            return;
          }
          last.out(punch, organization);
          const row = last.toRawRow(user.realName);
          row.bindGoogleApis(this.parent.service, this.parent.id, this.parent.auth);
          try {
            await this.saveRow(row);
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
                return;
              }
            }
            resolve(last);
          } catch (err) {
            reject(err);
            return;
          }
        } else {
          const row = punch.toRawRow(user.realName);
          try {
            const newRow = await this.appendNewRow(row);
            const request = {
              spreadsheetId: this.parent.id,
              range: RawDataSheet.title,
              auth: this.parent.auth,
              dateTimeRenderOption: 'FORMATTED_STRING',
              majorDimension: 'ROWS'
            };
            this.parent.service.spreadsheets.values.get(request, async (err, response) => {
              if (err || !response.values) {
                reject(`Could not get rawData rows: ${err}`);
              }
              const rows = this.rowsFromSheetData<Rows.RawDataRow>(response.values, RawDataSheet.title, Rows.RawDataRow);
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
  }

  export class EventsSheet extends Sheet<Rows.EventsRow> {
    static title: string = 'Events';
    static kind: Rows.SheetKind = 'events';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return new Promise<SheetOptions>((resolve, reject) => {
        const request = {
          spreadsheetId: this.parent.id,
          auth: this.parent.auth,
          dateTimeRenderOption: 'FORMATTED_STRING',
          majorDimension: 'ROWS',
          range: EventsSheet.title
        };
        this.parent.service.spreadsheets.values.get(request, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          const rows = this.rowsFromSheetData<Rows.EventsRow>(response.values, EventsSheet.title, Rows.EventsRow);
          opts.events = rows.map(row => CalendarEvent.parse(row));
          Console.silly(`Loaded ${opts.events.length} calendar events`);
          Console.silly('----------------------------------------');
          resolve(opts);
        })
      });
    }
  }

  export class UsersSheet extends Sheet<Rows.UsersRow> {
    static title: string = 'Employees';
    static kind: Rows.SheetKind = 'users';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return new Promise<SheetOptions>((resolve, reject) => {
        const request = {
          spreadsheetId: this.parent.id,
          auth: this.parent.auth,
          dateTimeRenderOption: 'FORMATTED_STRING',
          majorDimension: 'ROWS',
          range: UsersSheet.title
        };
        this.parent.service.spreadsheets.values.get(request, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          const rows = this.rowsFromSheetData<Rows.UsersRow>(response.values, UsersSheet.title, Rows.UsersRow);
          opts.users = rows.reduce((acc, row) => [...acc, User.parse(row)], []);
          Console.silly(`Loaded ${opts.users.length} users`);
          Console.silly('----------------------------------------');
          resolve(opts);
        });
      });
    }
  }

  export class VariablesSheet extends Sheet<Rows.VariablesRow> {
    static title: string = 'Variables';
    static kind: Rows.SheetKind = 'variables';

    async load(opts: SheetOptions): Promise<SheetOptions> {
      return new Promise<SheetOptions>((resolve, reject) => {
        const request = {
          spreadsheetId: this.parent.id,
          auth: this.parent.auth,
          dateTimeRenderOption: 'FORMATTED_STRING',
          majorDimension: 'ROWS',
          range: VariablesSheet.title
        };
        this.parent.service.spreadsheets.values.get(request, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          const rows = this.rowsFromSheetData<Rows.VariablesRow>(response.values, VariablesSheet.title, Rows.VariablesRow);
          opts = {
            vacation: 0,
            sick: 0,
            houndFrequency: 0,
            payWeek: null,
            holidays: [],
            clockChannel: '',
            exemptChannels: []
          } as SheetOptions;
          for (let row of rows) {
            if (row.vacation && +row.vacation !== 0) {
              opts.vacation = +row.vacation;
            }
            if (row.sick && +row.sick !== 0) {
              opts.sick = +row.sick;
            }
            if (row.houndFrequency && +row.houndFrequency !== 0) {
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
          Console.silly(`Loaded organization settings`);
          Console.silly('----------------------------------------');
          resolve(opts);
        });
      });
    }
  }
}

export class Worksheet {
  service: any;
  auth: any;
  isAuthorized: boolean;
  id: string;
  title: string;

  payroll: Sheets.PayrollSheet;
  projects: Sheets.ProjectsSheet;
  rawData: Sheets.RawDataSheet;
  events: Sheets.EventsSheet;
  users: Sheets.UsersSheet;
  variables: Sheets.VariablesSheet;

  constructor(sheetId?: string) {
    this.service = google.sheets('v4');
    this.isAuthorized = false;
    if (sheetId) {
      this.id = sheetId;
    }
  }

  async authorize(credentialsPath: string) {
    return new Promise((resolve, reject) => {
      credentialsPath = credentialsPath.replace('~', path.resolve(process.env.HOME));
      if (process.env['GOOGLE_APPLICATION_CREDENTIALS'] !== credentialsPath && fs.existsSync(credentialsPath) && path.extname(credentialsPath) === '.json') {
        process.env['GOOGLE_APPLICATION_CREDENTIALS'] = credentialsPath;
      }
      const auth = new googleAuth();
      Console.info('Waiting for authorization');
      auth.getApplicationDefault((err, authClient) => {
        if (err) {
          Console.error('Error while trying to retrieve access token', err);
          reject(err);
          return;
        }
        if (authClient.createScopedRequired && authClient.createScopedRequired()) {
          const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
          authClient = authClient.createScoped(scopes);
        }
        this.auth = authClient;
        this.isAuthorized = true;
        Console.info('Authorized successfully');
        resolve();
      });
    });
  }

  async loadOptions() {
    let opts;
    try {
      opts = await this.loadWorksheets();
      opts = await this.variables.load(opts);
      opts = await this.projects.load(opts);
      opts = await this.users.load(opts);
      opts = await this.events.load(opts);
      opts = await this.rawData.load(opts);
    } catch (err) {
      throw err;
    }
    return opts;
  }

  private async loadWorksheets() {
    return new Promise<SheetOptions>((resolve, reject) => {
      const request = {
        spreadsheetId: this.id,
        auth: this.auth
      };
      this.service.spreadsheets.get(request, (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        const { properties } = response;
        this.title = properties.title;

        const sheets: any[] = response.sheets;
        let problem = false;
        sheets.forEach(sheet => {
          const title = sheet.properties.title;
          if (title === Sheets.PayrollSheet.title) {
            this.payroll = new Sheets.PayrollSheet(this, sheet);
          } else if (title === Sheets.ProjectsSheet.title) {
            this.projects = new Sheets.ProjectsSheet(this, sheet);
          } else if (title === Sheets.RawDataSheet.title) {
            this.rawData = new Sheets.RawDataSheet(this, sheet);
          } else if (title === Sheets.EventsSheet.title) {
            this.events = new Sheets.EventsSheet(this, sheet);
          } else if (title === Sheets.UsersSheet.title) {
            this.users = new Sheets.UsersSheet(this, sheet);
          } else if (title === Sheets.VariablesSheet.title) {
            this.variables = new Sheets.VariablesSheet(this, sheet);
          } else {
            Console.error('Error loading worksheet ' + title + ' due to that sheet title being unknown/unavailable in Ibizan\'s configuration');
            problem = true;
          }
        });
        if (problem) {
          reject('Worksheet loading error - check the logs');
          return;
        } else if (!(this.rawData && this.payroll && this.variables && this.projects && this.users && this.events)) {
          reject('Worksheets failed to be associated properly');
          return;
        }
        Console.silly('----------------------------------------');
        resolve({} as SheetOptions);
      });
    });
  }
}