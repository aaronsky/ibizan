import moment from 'moment';

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
  interface Row {
    save(cb: (err: Error) => void);
    del(cb: (err: Error) => void);
  };
  interface Variables {
    vacation: string;
    sick: string;
    houndFrequency: string;
    payweek: string;
    clockChannel: string;
    exemptChannel: string;
    holidays: string;
    holidayOverride: string;
  };
  interface Projects {
    name: string;
    start: string;
    total: string;
  };
  interface Users {
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
  };
  interface RawData {
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
  };
  interface PayrollReports {
    date: string;
    name: string;
    paid: string;
    unpaid: string;
    logged: string;
    vacation: string;
    sick: string;
    overtime: string;
    holiday: string;
  };
  interface Events {
    date: string;
    name: string;
  };
  export type VariablesRow = Variables | Row;
  export type ProjectsRow = Projects | Row;
  export type UsersRow = Users | Row;
  export type RawDataRow = RawData | Row;
  export type PayrollReportsRow = PayrollReports | Row;
  export type EventsRow = Events | Row;
}

export interface Bot {
  config: any;
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
  on(scope: string, callback): void;
  setupWebserver(port: any, callback: (err: Error, webserver) => void): void;
  createWebhookEndpoints(webserver: any): void;
  createOauthEndpoints(webserver: any, callback: (err: Error, req, res) => void): void;
};

