
import * as GoogleSpreadsheet from 'google-spreadsheet';
import moment from 'moment';

import { momentForHoliday } from '../shared/moment-holiday';
import { HEADERS } from '../shared/constants';
import { Rows } from '../shared/common';
import Calendar, { CalendarEvent } from './calendar';
import Logger from '../logger/logger';
import Project from './project';
import User, { Settings, Timetable } from './user';
import Punch from './punch';

export default class Spreadsheet {
  sheet: GoogleSpreadsheet;
  initialized: boolean;
  title: string;
  id: string;
  url: string;
  rawData: any;
  payroll: any;
  variables: any;
  projects: any;
  employees: any;
  events: any;

  constructor(sheetId: string) {
    if (sheetId && sheetId !== 'test') {
      this.sheet = new GoogleSpreadsheet(sheetId);
    } else {
      this.sheet = false;
    }
    this.initialized = false;
  }
  async authorize(auth) {
    return new Promise((resolve, reject) => {
      this.sheet.useServiceAccountAuth(auth, (err) => {
        if (err) {
          reject(err);
        } else {
          Logger.Console.log('Authorized successfully');
          resolve();
        }
      });
      Logger.Console.log('Waiting for authorization');
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
    } catch (error) {
      throw `Couldn't download sheet data: ${error}`;
    }
    this.initialized = true;
    return opts;
  }
  async saveRow(row: any, rowName: string = 'row') {
    return new Promise((resolve, reject) => {
      row.save((err) => {
        if (err) {
          // Retry up to 3 times
          let retry = 1
          setTimeout(() => {
            if (retry <= 3) {
              Logger.Console.debug(`Retrying save of ${rowName}, attempt ${retry}...`);
              row.save((err) => {
                if (!err) {
                  Logger.Console.debug(`${rowName} saved successfully`);
                  resolve(row);
                  return true;
                }
              });
              retry += 1;
            } else {
              reject(err);
              Logger.Console.error(`Unable to save ${rowName}`, new Error(err));
            }
          }, 1000);
        } else {
          resolve(row);
        }
      });
    });
  }
  async newRow(sheet, row, rowName: string = 'row') {
    return new Promise((resolve, reject) => {
      if (!sheet) {
        reject('No sheet passed to newRow');
      } else if (!row) {
        reject('No row passed to newRow');
      } else {
        sheet.addRow(row, (err) => {
          if (err) {
            // Retry up to 3 times
            let retry = 1
            setTimeout(() => {
              if (retry <= 3) {
                Logger.Console.debug(`Retrying adding ${rowName}, attempt ${retry}...`);
                sheet.addRow(row, (err) => {
                  if (!err) {
                    Logger.Console.debug(`${rowName} saved successfully`);
                    resolve(row);
                    return true;
                  }
                });
                retry += 1;
              } else {
                reject(err);
                Logger.Console.error(`Unable to add ${rowName}`, new Error(err));
              }
            }, 1000);
          } else {
            resolve(row);
          }
        });
      }
    });
  }
  async enterPunch(punch: Punch, user: User) {
    return new Promise<Punch>(async (resolve, reject) => {
      const valid = punch.isValid(user);
      if (!punch || !user) {
        reject('Invalid parameters passed: Punch or user is undefined');
      } else if (typeof valid === 'string') {
        reject(valid);
      } else {
        const headers = HEADERS.rawdata;
        if (punch.mode === 'out') {
          if (user.punches && user.punches.length > 0) {
            const len = user.punches.length;
            let last;
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
              return;
            }
            last.out(punch);
            const row = last.toRawRow(user.name);
            try {
              await this.saveRow(row, `punch for ${user.name}`);
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
            const newRow = await this.newRow(this.rawData, row);
            this.rawData.getRows({}, async (err, rows) => {
              if (err || !rows) {
                reject(`Could not get rawData rows: ${err}`);
              } else {
                const rowMatches = rows.filter(r => r[headers.id] === row[headers.id]);
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
                  resolve(punch);
                }
              }
            });
          } catch (err) {
            reject(`Could not add row: ${err}`);
          }
        }
      }
    });
  }
  async generateReport(reports) {
    return new Promise<number>((resolve, reject) => {
      let numberDone = 0;
      for (let row of reports) {
        this.payroll.addRow(row, (err) => {
          if (err) {
            reject(err);
          } else {
            numberDone += 1;
            if (numberDone >= reports.length) {
              resolve(numberDone);
            }
          }
        });
      }
    });
  }
  async addEventRow(row) {
    return new Promise((resolve, reject) => {
      this.events.addRow(row, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  private async loadWorksheets() {
    return new Promise((resolve, reject) => {
      this.sheet.getInfo((err, info) => {
        if (err) {
          reject(err);
        } else {
          this.title = info.title;
          let id = info.id;
          id = id.replace('https://spreadsheets.google.com/feeds/worksheets/', '');
          this.id = id.replace('/private/full', '');
          this.url = `https://docs.google.com/spreadsheets/d/${this.id}`;
          for (let worksheet of info.worksheets) {
            let title = worksheet.title;
            const words = title.split(' ');
            title = words[0].toLowerCase();
            let i = 1;
            while (title.length < 6 && i < words.length) {
              title = title.concat(words[i]);
              i += 1;
            }
            this[title] = worksheet;
          }
          if (!(this.rawData && this.payroll && this.variables && this.projects && this.employees && this.events)) {
            reject('Worksheets failed to be associated properly');
          } else {
            Logger.Console.fun('----------------------------------------');
            resolve({});
          }
        }
      });
    });
  }
  private async loadVariables(opts: any) {
    return new Promise((resolve, reject) => {
      this.variables.getRows((err, rows) => {
        if (err) {
          reject(err);
        } else {
          const variableRows = rows as Rows.VariablesRow[];
          const opts = {
            vacation: 0,
            sick: 0,
            houndFrequency: 0,
            payWeek: null,
            holidays: [],
            clockChannel: '',
            exemptChannels: []
          };
          const VARIABLE_HEADERS = HEADERS.variables;
          for (let row of variableRows) {
            for (let key in VARIABLE_HEADERS) {
              const header = VARIABLE_HEADERS[key];
              if (row[header]) {
                if (header === VARIABLE_HEADERS.holidayOverride) {
                  continue;
                } else if (header === VARIABLE_HEADERS.holidays) {
                  const name = row[header];
                  let date;
                  if (row[VARIABLE_HEADERS.holidayOverride]) {
                    date = moment(row[VARIABLE_HEADERS.holidayOverride], 'MM/DD/YYYY');
                  } else {
                    date = momentForHoliday(row[VARIABLE_HEADERS.holidays]);
                  }
                  opts[key].push({
                    name,
                    date
                  });
                } else if (header === VARIABLE_HEADERS.payweek) {
                  opts[key] = moment(row[VARIABLE_HEADERS.payweek], 'MM/DD/YYYY');
                } else if (header === VARIABLE_HEADERS.exemptChannels) {
                  let channel = row[header];
                  if (channel) {
                    channel = channel.replace('#', '');
                    opts[key].push(channel);
                  }
                } else {
                  if (isNaN(row[header])) {
                    const value = row[header];
                    if (value) {
                      opts[key] = value.trim().replace('#', '');
                    }
                  } else {
                    opts[key] = parseInt(row[header]);
                  }
                }
              }
            }
          }
          Logger.Console.fun('Loaded organization settings');
          Logger.Console.fun('----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadProjects(opts: any) {
    return new Promise((resolve, reject) => {
      this.projects.getRows((err, rows) => {
        if (err) {
          reject(err);
        } else {
          const projectRows = rows as Rows.ProjectsRow[];
          const projects = [];
          for (let row of projectRows) {
            const project = Project.parse(row);
            if (project) {
              projects.push(project);
            }
          }
          opts.projects = projects;
          Logger.Console.fun(`Loaded ${projects.length} projects`);
          Logger.Console.fun('----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadEmployees(opts: any) {
    return new Promise((resolve, reject) => {
      this.employees.getRows((err, rows) => {
        if (err) {
          reject(err);
        } else {
          const userRows = rows as Rows.UsersRow[];
          const users = [];
          for (let row of rows) {
            const user = User.parse(row);
            if (user) {
              users.push(user);
            }
          }
          opts.users = users;
          Logger.Console.fun(`Loaded ${users.length} users`);
          Logger.Console.fun('----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
  private async loadEvents(opts: any) {
    return new Promise((resolve, reject) => {
      this.events.getRows((err, rows) => {
        if (err) {
          reject(err);
        } else {
          const eventsRows = rows as Rows.EventsRow[];
          const events = [];
          for (let row of eventsRows) {
            const calendarEvent = CalendarEvent.parse(row);
            if (calendarEvent) {
              events.push(calendarEvent);
            }
          }
          opts.events = events;
          Logger.Console.fun(`Loaded ${events.length} calendar events`);
          Logger.Console.fun('----------------------------------------');
          resolve(opts);
        }
      })
    });
  }
  private async loadPunches(opts: any) {
    return new Promise((resolve, reject) => {
      this.rawData.getRows((err, rows) => {
        if (err) {
          reject(err);
        } else {
          const punchRows = rows as Rows.RawDataRow[];
          for (let row of punchRows) {
            const user = opts.users.filter((item, index, arr) => item.name === row[HEADERS.rawdata.name])[0];
            const punch = Punch.parseRaw(user, row, opts.projects);
            if (punch && user) {
              user.punches.push(punch);
            }
          }
          Logger.Console.fun(`Loaded ${rows.length} punches for ${opts.users.length} users`);
          Logger.Console.fun('----------------------------------------');
          resolve(opts);
        }
      });
    });
  }
}
