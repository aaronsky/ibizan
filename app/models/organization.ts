import { App } from '../app';

import * as moment from 'moment';

import { Rows } from '../shared/rows';
import { Console } from '../logger';
import { TeamConfig } from '../config';
import { Calendar, CalendarEvent } from './calendar';
import { Spreadsheet } from './sheet';
import { Project } from './project';
import { User, Settings } from './user';

interface GoogleAuth {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    token?: string;
}

export class Organization {
    readonly name: string = 'Unnamed organization';
    readonly config: TeamConfig;
    spreadsheet: Spreadsheet;
    initTime: moment.Moment;
    users: User[];
    projects: Project[];
    calendar: Calendar;
    clockChannel: string;
    exemptChannels: string[];
    shouldHound: boolean = true;
    shouldResetHound: boolean = true;
    houndFrequency: number;

    constructor(config: TeamConfig) {
        this.config = config;
        this.name = config.name;
        Console.log('silly', `Welcome to ${this.name}!`);
        this.initTime = moment();
        this.spreadsheet = new Spreadsheet(config.google.sheetId);

        if (this.spreadsheet.id) {
            this.sync({
                clientId: App.config.google.clientId,
                clientSecret: App.config.google.clientSecret,
                redirectUri: App.config.google.redirectUri,
                token: App.config.google.token
            }).then(() => Console.info('Options loaded')).catch(err => Console.error("Failed to sync", err));
        } else {
            Console.warn('Sheet not initialized, no spreadsheet ID was provided');
        }
    }
    ready() {
        return this.spreadsheet.initialized;
    }
    async sync(auth?: GoogleAuth) {
        try {
            await this.spreadsheet.authorize(auth.clientId, auth.clientSecret, auth.redirectUri, auth.token);
            let opts = await this.spreadsheet.loadOptions();
            if (opts) {
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
                this.projects = opts.projects as Project[];
                this.calendar = new Calendar(opts.vacation, opts.sick, opts.holidays, opts.payWeek, opts.events);
                this.houndFrequency = opts.houndFrequency;
                this.clockChannel = opts.clockChannel;
                this.exemptChannels = opts.exemptChannels;
            }
        } catch (err) {
            throw err;
        }
        return true;
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
        Console.debug(`User ${name} could not be found`);
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
        Console.debug(`Person ${name} could not be found`);
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
        Console.debug(`Project ${name} could not be found`);
    }
    async addEvent(date: string | moment.Moment, name: string) {
        let dateObject;
        if (typeof date === 'string') {
            dateObject = moment(date, 'MM/DD/YYYY');
        } else {
            dateObject = date;
        }
        if (!dateObject.isValid()) {
            throw 'Invalid date given to addEvent';
        } else if (!name || name.length === 0) {
            throw 'Invalid name given to addEvent';
        }
        const calendarEvent = new CalendarEvent(dateObject, name);
        const calendar = this.calendar;
        try {
            await this.spreadsheet.newRow(calendarEvent.toEventRow(), 'events');
        } catch (err) {
            throw `Could not add event row: ${err}`;
        }
        calendar.events.push(calendarEvent);
        return calendarEvent;
    }
    async generateReport(start: any, end: any, send: boolean = false): Promise<number | Rows.PayrollReportsRow[]> {
        if (!this.spreadsheet) {
            throw 'No spreadsheet is loaded, report cannot be generated';
        } else if (!start || !end) {
            throw 'No start or end date were passed as arguments';
        }
        Console.info(`Generating payroll from ${start.format('MMM Do, YYYY')} to ${end.format('MMM Do, YYYY')}`);

        const reports: Rows.PayrollReportsRow[] = [];

        for (let user of this.users) {
            const row = user.toRawPayroll(start, end);
            if (row) {
                reports.push(row);
            }
        }
        reports.sort((left: Rows.PayrollReportsRow, right: Rows.PayrollReportsRow) => {
            if (+left.logged < +right.logged || +left.vacation < +right.vacation || +left.sick < +right.sick || +left.unpaid < +right.unpaid) {
                return -1;
            } else if (+left.logged > +right.logged || +left.vacation > +right.vacation || +left.sick > +right.sick || +left.unpaid > +right.unpaid) {
                return 1;
            }
            return 0;
        });
        if (send) {
            try {
                const numberDone = await this.spreadsheet.generateReport(reports);
                return numberDone;
            } catch (err) {
                throw err;
            }
        } else {
            return reports;
        }
    }
    dailyReport(reports: Rows.PayrollReportsRow[], today: any, yesterday: any) {
        let response = `DAILY WORK LOG: *${yesterday.format('dddd MMMM D YYYY').toUpperCase()}*\n`;
        let logBuffer = '';
        let offBuffer = '';

        for (let report of reports) {
            let recorded = false;
            if (+report.logged > 0) {
                let status = `${report.extra.slack}:\t\t\t${+report.logged} hours`;
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
            if (+report.vacation > 0) {
                offBuffer += `${report.extra.slack}:\t${+report.vacation} hours vacation\n`
                recorded = true
            }
            if (+report.sick > 0) {
                offBuffer += `${report.extra.slack}:\t${+report.sick} hours sick\n`
                recorded = true
            }
            if (+report.unpaid > 0) {
                offBuffer += `${report.extra.slack}:\t${+report.unpaid} hours unpaid\n`
                recorded = true
            }
            if (!recorded) {
                offBuffer += `${report.extra.slack}:\t0 hours\n`
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
                    response += `${upcomingEvent.name} in ${weeks} ${weeks > 1 ? 'weeks' : 'week'}${daysRemainder > 0 ? ', ' + daysRemainder + ' ' + daysArticle : ''}\n`
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