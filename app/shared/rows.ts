import * as assert from 'assert';

export const HEADERS = {
    variables: [
        { field: 'vacation', header: 'Vacation Hours (for Salaried Employees)' },
        { field: 'sick', header: 'Sick Hours (for Salaried Employees)' },
        { field: 'houndFrequency', header: 'Default Hounding Frequency in Hours' },
        { field: 'payweek', header: 'Pay Day for a Reference Point' },
        { field: 'clockChannel', header: 'Time Logging Channel' },
        { field: 'exemptChannels', header: 'Hounding Channel Exemptions' },
        { field: 'holidays', header: 'Work Holidays' },
        { field: 'holidayOverride', header: 'Date' }
    ],
    projects: [
        { field: 'name', header: 'Project' },
        { field: 'start', header: 'Week Starting' },
        { field: 'total', header: 'Total # of Hours' }
    ],
    users: [
        { field: 'slackname', header: 'Slack User Name' },
        { field: 'name', header: 'Employee Name' },
        { field: 'salary', header: 'Salary?' },
        { field: 'start', header: 'Active Hours (Begin)' },
        { field: 'end', header: 'Active Hours (End)' },
        { field: 'timezone', header: 'Time Zone' },
        { field: 'shouldHound', header: 'Should Hound?' },
        { field: 'houndFrequency', header: 'Hound Frequency' },
        { field: 'vacationAvailable', header: 'Total Vacation Days Available' },
        { field: 'vacationLogged', header: 'Total Vacation Days Logged' },
        { field: 'sickAvailable', header: 'Total Sick Days Available' },
        { field: 'sickLogged', header: 'Total Sick Days Logged' },
        { field: 'unpaidLogged', header: 'Total Unpaid Days Logged' },
        { field: 'overtime', header: 'Total Overtime' },
        { field: 'totalLogged', header: 'Total Logged Hours' },
        { field: 'averageLogged', header: 'Average Hours Logged / Week' },
        { field: 'lastPing', header: 'Last Ping' }
    ],
    rawData: [
        { field: 'id', header: 'Punch ID' },
        { field: 'today', header: 'Date Entered' },
        { field: 'name', header: 'Employee' },
        { field: 'in', header: 'In' },
        { field: 'out', header: 'Out' },
        { field: 'totalTime', header: 'Elapsed Time' },
        { field: 'blockTime', header: 'Block' },
        { field: 'notes', header: 'Notes' },
        { field: 'project1', header: 'Project 1' },
        { field: 'project2', header: 'Project 2' },
        { field: 'project3', header: 'Project 3' },
        { field: 'project4', header: 'Project 4' },
        { field: 'project5', header: 'Project 5' },
        { field: 'project6', header: 'Project 6' }
    ],
    payroll: [
        { field: 'date', header: 'Payroll Date' },
        { field: 'name', header: 'Employee Name' },
        { field: 'paid', header: 'Paid Hours' },
        { field: 'unpaid', header: 'Unpaid Hours' },
        { field: 'logged', header: 'Logged Hours' },
        { field: 'vacation', header: 'Vacation Hours' },
        { field: 'sick', header: 'Sick Hours' },
        { field: 'overtime', header: 'Overtime Hours' },
        { field: 'holiday', header: 'Holiday Hours' }
    ],
    events: [
        { field: 'date', header: 'Event Date' },
        { field: 'name', header: 'Event Name' }
    ]
};

export namespace Rows {
    export type SheetKind = 'variables' | 'projects' | 'users' | 'rawData' | 'payroll' | 'events';
    export abstract class Row {
        kind: SheetKind;
        range: string;

        constructor(values: any[], range: string, kind: SheetKind) {
            this.kind = kind;
            this.fromGoogleValues(values, range);
        }
        static formatRowRange(sheetTitle: string, index: number) {
            const formattedRange = `${sheetTitle}!${index}:${index}`;
            return formattedRange;
        }
        bindGoogleApis(service, sheetId, auth) {
            this.save = this.save.bind(this, service, sheetId, auth);
            this.del = this.del.bind(this, service, sheetId, auth);
        }
        fromGoogleValues(values: any[], range) {
            this.range = range;
            const headers = HEADERS[this.kind];
            for (let i = 0; i < headers.length; i++) {
                this[headers[i].field] = values[i] || '';
            }
        }
        toGoogleValues() {
            const values = [];
            const headers = HEADERS[this.kind];
            for (let i = 0; i < headers.length; i++) {
                values.push(this[headers[i].field]);
            }
            return {
                range: this.range,
                majorDimension: 'ROWS',
                values: [values]
            };
        }
        async save() {
            const [service, sheetId, auth] = Array.prototype.slice.call(arguments);
            const values = this.toGoogleValues();
            const request = {
                spreadsheetId: sheetId,
                range: values.range,
                valueInputOption: 'USER_ENTERED',
                auth: auth,
                resource: values
            };
            return new Promise<void>((resolve, reject) => {
                service.spreadsheets.values.update(request, (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        }
        async del() {
            const [service, sheetId, auth] = Array.prototype.slice.call(arguments);
            const request = {
                spreadsheetId: sheetId,
                range: this.range,
                auth: auth
            };
            return new Promise<void>((resolve, reject) => {
                service.spreadsheets.values.clear(request, (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
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
        constructor(values: any[], range: string) {
            super(values, range, 'variables');
        }
    };
    export class ProjectsRow extends Row {
        name: string;
        start: string;
        total: string;
        constructor(values: any[], range: string) {
            super(values, range, 'projects');
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
        constructor(values: any[], range: string) {
            super(values, range, 'users');
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
        constructor(values: any[], range: string) {
            super(values, range, 'rawData');
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
        constructor(values: any[], range: string) {
            super(values, range, 'payroll');
        }
    };
    export class EventsRow extends Row {
        date: string;
        name: string;
        constructor(values: any[], range: string) {
            super(values, range, 'events');
        }
    };
}