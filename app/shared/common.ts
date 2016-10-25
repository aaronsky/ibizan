import * as moment from 'moment';
import { HEADERS } from '../shared/constants';

export function typeIsArray(value: any) {
  return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export function random(items: any[]): any {
  return items[Math.floor(Math.random() * items.length)];
}

export interface PunchTime extends Array<moment.Moment> {
  [index: number]: moment.Moment;
  start?: moment.Moment;
  end?: moment.Moment;
  block?: number;
};

export namespace Rows {
  type RawGoogleRow = { [props: string]: any, save: (cb: (err: Error) => void) => void, del: (cb: (err: Error) => void) => void };
  abstract class Row {
    protected raw: any;
    save: (cb: (err: Error) => void) => void;
    del: (cb: (err: Error) => void) => void;

    constructor(kind: string, raw: RawGoogleRow) {
      const headers = HEADERS[kind];
      for (let key in headers) {
        this[key] = raw[headers[key]];
      }
      this.raw = raw;
      this.save = raw.save;
      this.del = raw.del;
    }
  }
  export class VariablesRow extends Row {
    vacation: string;
    sick: string;
    houndFrequency: string;
    payweek: string;
    clockChannel: string;
    exemptChannel: string;
    holidays: string;
    holidayOverride: string;
    constructor(raw: RawGoogleRow) {
      super('variables', raw);
    }
  };
  export class ProjectsRow extends Row {
    name: string;
    start: string;
    total: string;
    constructor(raw: RawGoogleRow) {
      super('projects', raw);
    }
  };
  export class UsersRow extends Row {
    slackname: string;
    name: string;
    salary: string;
    start: string;
    end: string;
    timezone: string;
    shouldHound: string;
    houndFrequency: string;
    vacationAvailable: string;
    vacationLogged: string;
    sickAvailable: string;
    sickLogged: string;
    unpaidLogged: string;
    overtime: string;
    totalLogged: string;
    averageLogged: string;
    lastPing: string;
    constructor(raw: RawGoogleRow) {
      super('users', raw);
    }
  };
  export class RawDataRow extends Row {
    id: string;
    today: string;
    name: string;
    in: string;
    out: string;
    totalTime: string;
    blockTime: string;
    notes: string;
    project1: string;
    project2: string;
    project3: string;
    project4: string;
    project5: string;
    project6: string;
    constructor(raw: RawGoogleRow) {
      super('rawdata', raw);
    }
  };
  export class PayrollReportsRow extends Row {
    date: string;
    name: string;
    paid: string;
    unpaid: string;
    logged: string;
    vacation: string;
    sick: string;
    overtime: string;
    holiday: string;
    extra: any;
    constructor(raw: RawGoogleRow) {
      super('payrollreports', raw);
    }
  };
  export class EventsRow extends Row {
    date: string;
    name: string;
    constructor(raw: RawGoogleRow) {
      super('events', raw);
    }
  };
}

export interface Bot {
  config: any;
  api: any;
  storage: {
    users: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
    channels: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
    teams: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
  };
  say(message: any);
  reply(message: any, reply: any);
  startRTM(callback: (err: Error) => void);
  startPrivateConversation(user: any, callback: (err: Error, conversation: any) => void);
}

export interface Controller {
  events: any;
  config: any;
  tasks: any;
  taskCount: number;
  convoCount: number;
  memoryStore: {
    users: any;
    channels: any;
    teams: any;
  };
  utterances: {
    yes: RegExp;
    no: RegExp;
    quit: RegExp;
  };
  middleware: {
    send: any;
    receive: any;
    spawn: any;
  };
  webserver: any;
  log: any;
  storage: {
    teams: any;
  }
  spawn(team);
  on(scope: string, callback: (bot: Bot, message: any) => void);
  hears(pattern: string | string[], modes: string | string[], callback: (bot: Bot, message: any) => void);
  hears(pattern: string | string[], modes: string | string[], middleware: () => void, callback: (bot: Bot, message: any) => void);
  setupWebserver(port: any, callback: (err: Error, webserver) => void): void;
  createWebhookEndpoints(webserver: any): void;
  createOauthEndpoints(webserver: any, callback: (err: Error, req, res) => void): void;
};

