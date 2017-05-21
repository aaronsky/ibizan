
import * as moment from 'moment';

import { isDMChannel } from '../shared/common';
import { TeamConfig } from '../config';
import { Calendar, CalendarEvent } from './calendar';
import { Project } from './project';
import { Rows } from './rows';
import { Worksheet } from './sheet';
import { User, Settings } from './user';
import { App } from '../app';

export class Organization {
    readonly name: string = 'Unnamed organization';
    readonly config: TeamConfig;
    spreadsheet: Worksheet;
    initTime: moment.Moment;
    initialized: boolean = false;
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
        console.silly(`Welcome to ${this.name}!`);
        this.initTime = moment();
        this.spreadsheet = new Worksheet(config.google.sheetId);

        if (this.spreadsheet.id && this.spreadsheet.id !== 'test') {
            this.sync(App.config.googleCredentials)
                .then(() => console.log(`Options loaded for ${this.name}`))
                .catch(err => console.error(`Failed to sync for ${this.name}`, err));
        } else {
            console.warn(`Sheet not initialized for ${this.name}, no spreadsheet ID was provided`);
        }
    }

    ready() {
        return this.initialized;
    }

    async sync(googleCredentialsPath?: string) {
        try {
            if (!googleCredentialsPath && !this.spreadsheet.isAuthorized) {
                throw new Error('Trying to sync while unauthorized, and without supplying a path to a credentials file.')
            }
            if (googleCredentialsPath) {
                await this.spreadsheet.authorize(googleCredentialsPath);
            }
            const opts = await this.spreadsheet.loadOptions();
            if (!opts) {
                throw new Error('Data could not be loaded for this organization.');
            }
            const old = this.users && this.users.slice();
            this.users = opts.users;
            if (old) {
                old.forEach(user => {
                    const newUser = this.getUserBySlackName(user.slackName);
                    if (newUser) {
                        newUser.settings = Settings.fromSettings(user.settings);
                    }
                });
            }
            this.projects = opts.projects;
            this.calendar = new Calendar(opts.vacation, opts.sick, opts.holidays, opts.events);
            this.houndFrequency = opts.houndFrequency;
            this.clockChannel = opts.clockChannel;
            this.exemptChannels = opts.exemptChannels;
            this.initialized = true;
        } catch (err) {
            throw err;
        }
        return true;
    }

    getUserBySlackName(name: string) {
        const matches = this.users.filter(user => user.slackName === name);
        if (matches.length === 0 || !matches[0]) {
            console.debug(`A user by the slack name of ${name} could not be found`);
            return null;
        }
        return matches[0];
    }

    getUserByRealName(name: string) {
        const matches = this.users.filter(user => user.realName === name);
        if (matches.length === 0 || !matches[0]) {
            console.debug(`A user by the real name ${name} could not be found`);
            return null;
        }
        return matches[0];
    }

    getProjectByName(name: string) {
        name = name.replace('#', '');
        const matches = this.projects.filter(project => project.name === name);
        if (matches.length === 0 || !matches[0]) {
            console.debug(`A project named #${name} could not be found`);
            return null;
        }
        return matches[0];
    }

    matchesClockChannel(name: string): boolean {
        return name === this.clockChannel;
    }

    matchesProject(channel: string): boolean {
        return !this.matchesClockChannel(channel) && !isDMChannel(channel) && !!this.getProjectByName(channel);
    }

    async addEvent(date: string | moment.Moment, name: string) {
        let dateObject;
        if (typeof date === 'string') {
            dateObject = moment(date, 'MM/DD/YYYY');
        } else {
            dateObject = date;
        }
        if (!dateObject.isValid()) {
            throw new Error('Invalid date given to addEvent');
        } else if (!name || name.length === 0) {
            throw new Error('Invalid name given to addEvent');
        }
        const calendarEvent = new CalendarEvent(dateObject, name);
        const calendar = this.calendar;
        try {
            await this.spreadsheet.events.appendNewRow(calendarEvent.toEventRow());
        } catch (err) {
            throw new Error(`Could not add event row: ${err.message}`);
        }
        calendar.events.push(calendarEvent);
        return calendarEvent;
    }

    async generateReport(start: moment.Moment, end: moment.Moment, shouldPublish: boolean = false): Promise<number | Rows.PayrollReportsRow[]> {
        if (!this.spreadsheet) {
            throw new Error('No spreadsheet is loaded, report cannot be generated');
        } else if (!start || !end) {
            throw new Error('No start or end date were passed as arguments');
        }
        console.log(`Generating payroll from ${start.format('MMM Do, YYYY')} to ${end.format('MMM Do, YYYY')}`);

        const reports = this.users.reduce((acc, user) => {
            const row = user.toRawPayroll(start, end);
            if (row) {
                return [...acc, row];
            }
            return acc;
        }, [] as Rows.PayrollReportsRow[])
            .sort((left, right) => {
                if (+left.logged < +right.logged ||
                    +left.vacation < +right.vacation ||
                    +left.sick < +right.sick ||
                    +left.unpaid < +right.unpaid) {
                    return -1;
                } else if (+left.logged > +right.logged ||
                    +left.vacation > +right.vacation ||
                    +left.sick > +right.sick ||
                    +left.unpaid > +right.unpaid) {
                    return 1;
                }
                return 0;
            });
        if (shouldPublish) {
            try {
                const numberDone = await this.spreadsheet.payroll.generateReport(reports);
                if (numberDone === reports.length) {
                    return reports;
                }
                return numberDone;
            } catch (err) {
                throw err;
            }
        }
        return reports;
    }

    dailyReport(reports: Rows.PayrollReportsRow[], today: moment.Moment, yesterday: moment.Moment) {
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
            upcomingEvents.forEach(event => {
                const days = event.date.diff(now, 'days');
                const weeks = event.date.diff(now, 'weeks');
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
                    response += `${event.name} in ${weeks} ${weeks > 1 ? 'weeks' : 'week'}${daysRemainder > 0 ? ', ' + daysRemainder + ' ' + daysArticle : ''}\n`
                } else {
                    response += `*${event.name}* ${days > 1 ? 'in *' + days + ' days*' : '*tomorrow*'}\n`
                }
            });
        }
        return response;
    }

    resetHounding() {
        return this.users.reduce((acc, user) => {
            if (user.settings && user.settings.shouldResetHound) {
                user.settings.fromSettings({
                    shouldHound: true
                });
            }
            return acc + 1;
        }, 0);
    }

    setHoundFrequency(frequency: number) {
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