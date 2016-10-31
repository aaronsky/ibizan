export const HEADERS = {
    variables: {
        vacation: 'vacationhoursforsalariedemployees',
        sick: 'sickhoursforsalariedemployees',
        houndFrequency: 'defaulthoundingfrequencyinhours',
        payweek: 'paydayforareferencepoint',
        clockChannel: 'timeloggingchannel',
        exemptChannels: 'houndingchannelexemptions',
        holidays: 'workholidays',
        holidayOverride: 'date',
    },
    projects: {
        name: 'project',
        start: 'weekstarting',
        total: 'totalofhours',
    },
    users: {
        slackname: 'slackusername',
        name: 'employeename',
        salary: 'salary',
        start: 'activehoursbegin',
        end: 'activehoursend',
        timezone: 'timezone',
        shouldHound: 'shouldhound',
        houndFrequency: 'houndfrequency',
        vacationAvailable: 'totalvacationdaysavailable',
        vacationLogged: 'totalvacationdayslogged',
        sickAvailable: 'totalsickdaysavailable',
        sickLogged: 'totalsickdayslogged',
        unpaidLogged: 'totalunpaiddayslogged',
        overtime: 'totalovertime',
        totalLogged: 'totalloggedhours',
        averageLogged: 'averagehoursloggedweek',
        lastPing: 'lastping',
    },
    rawdata: {
        id: 'punchid',
        today: 'dateentered',
        name: 'employee',
        in: 'in',
        out: 'out',
        totalTime: 'elapsedtime',
        blockTime: 'block',
        notes: 'notes',
        project1: 'project1',
        project2: 'project2',
        project3: 'project3',
        project4: 'project4',
        project5: 'project5',
        project6: 'project6',
    },
    payrollreports: {
        date: 'payrolldate',
        name: 'employeename',
        paid: 'paidhours',
        unpaid: 'unpaidhours',
        logged: 'loggedhours',
        vacation: 'vacationhours',
        sick: 'sickhours',
        overtime: 'overtimehours',
        holiday: 'holidayhours',
    },
    events: {
        date: 'eventdate',
        name: 'eventname',
    },
};

export namespace Rows {
    interface RawGoogleRow {
        [props: string]: any;
        save: (cb: (err: Error) => void) => void;
        del: (cb: (err: Error) => void) => void;
    }

    type RowKind = 'variables' | 'projects' | 'users' | 'rawdata' | 'payrollreports' | 'events';

    abstract class Row {
        kind: RowKind;
        protected _raw: any;

        constructor(kind: RowKind, raw: RawGoogleRow) {
            this.kind = kind;
            const headers = HEADERS[kind];
            for (let key in headers) {
                this[key] = raw[headers[key]];
            }
            this._raw = raw;
        }
        get raw(): any {
            const headers = HEADERS[this.kind];
            for (let key in headers) {
                this._raw[headers[key]] = this[key];
            }
            return this._raw;
        }
        save(cb: (err: Error) => void) {
            this._raw.save(cb);
        }
        del(cb: (err: Error) => void) {
            this._raw.del(cb);
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