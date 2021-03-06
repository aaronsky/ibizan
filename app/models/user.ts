import * as moment from 'moment-timezone';

import { MODES, TIMEZONE } from '../shared/constants';
import { Mode } from '../shared/common';
import { holidayForMoment } from '../shared/moment-holiday';
import { Slack } from '../logger';
import { Rows } from './rows';
import { Punch } from './punch';

function getPositiveNumber(input?: number | any, current: number = 0) {
    if (!input && input !== 0) {
        return current;
    }
    const inputNum = +input;
    if (isNaN(+input) || inputNum < 0) {
        return current;
    }
    return input;
}

export class Timetable {
    private _start: moment.Moment;
    private _end: moment.Moment;
    private _timezone: any;
    vacationTotal: number;
    vacationAvailable: number;
    sickTotal: number;
    sickAvailable: number;
    private _unpaidTotal: number;
    private _loggedTotal: number;
    private _averageLoggedTotal: number;
    holiday: number;

    get start(): moment.Moment {
        return this._start;
    }
    set start(newStart: moment.Moment) {
        this._start = moment.tz(newStart.format('hh:mm a'), 'hh:mm a', this.timezone.name);
    }
    get end(): moment.Moment {
        return this._end;
    }
    set end(newEnd) {
        this._end = moment.tz(newEnd.format('hh:mm a'), 'hh:mm a', this.timezone.name);
    }
    get timezone(): any {
        return this._timezone;
    }
    set timezone(newTimezone) {
        this._timezone = newTimezone;
        this._start = moment.tz(this._start.format('hh:mm a'), 'hh:mm a', this.timezone.name);
        this._end = moment.tz(this._end.format('hh:mm a'), 'hh:mm a', this.timezone.name);
    }
    get unpaidTotal(): number {
        return this._unpaidTotal;
    }
    set unpaidTotal(newTotal) {
        this._unpaidTotal = getPositiveNumber(newTotal, this._unpaidTotal);
    }
    get loggedTotal(): number {
        return this._loggedTotal;
    }
    set loggedTotal(newTotal) {
        this._loggedTotal = getPositiveNumber(newTotal, this._loggedTotal);
    }
    get averageLogged(): number {
        return this._averageLoggedTotal;
    }
    set averageLogged(newTotal) {
        this._averageLoggedTotal = getPositiveNumber(newTotal, this._averageLoggedTotal);
    }

    constructor(start: string | moment.Moment, end: string | moment.Moment, timezone) {
        let timezoneName = '';
        if (typeof timezone === 'string') {
            this._timezone = moment.tz.zone(timezone);
            timezoneName = timezone;
        } else if (typeof timezone === 'object' && timezone.name) {
            this._timezone = moment.tz.zone(timezone.name);
            timezoneName = timezone.name;
        }

        if (typeof start === 'string') {
            if (timezone)
                this._start = moment.tz(start, 'hh:mm a', timezoneName);
        } else {
            this._start = moment.tz(start, timezoneName);
        }

        if (typeof end === 'string') {
            this._end = moment.tz(end, 'hh:mm a', timezoneName);
        } else {
            this._end = moment.tz(end, timezoneName);
        }
    }
    setVacation(total, available) {
        this.vacationTotal = getPositiveNumber(total, this.vacationTotal);
        this.vacationAvailable = getPositiveNumber(available, this.vacationAvailable);
    }
    setSick(total, available) {
        this.sickTotal = getPositiveNumber(total, this.sickTotal);
        this.sickAvailable = getPositiveNumber(available, this.sickAvailable);
    }
    activeHours(): [moment.Moment, moment.Moment] {
        const now = moment.tz(this.timezone.name);
        const start = this.start.year(now.year()).dayOfYear(now.dayOfYear());
        const end = this.end.year(now.year()).dayOfYear(now.dayOfYear());
        return [start, end];
    }
    activeTime(): number {
        const rawTime = +(this.end.diff(this.start, 'hours', true).toFixed(2));
        return Math.min(8, rawTime);
    }
    toDays(hours): number {
        return hours / this.activeTime();
    }
}

interface LastMessage {
    time: moment.Moment;
    channel: string;
};

export class Settings {
    shouldHound: boolean;
    shouldResetHound: boolean;
    houndFrequency: number;
    lastMessage: LastMessage;
    lastPing: moment.Moment;

    private constructor() {
        this.shouldHound = true;
        this.shouldResetHound = true;
        this.houndFrequency = -1;
        this.lastMessage = null;
        this.lastPing = null;
    }

    static fromSettings(settings?: Object) {
        const newSetting = new Settings();
        newSetting.fromSettings(settings);
        return newSetting;
    }
    fromSettings(opts: Object) {
        if (!opts || typeof opts !== 'object') {
            return;
        }
        Object.keys(opts).forEach(setting => {
            this[setting] = opts[setting];
        });
    }
}

export class User {
    realName: string;
    slackName: string;
    slackId: string;
    salary: boolean;
    timetable: Timetable;
    row: Rows.UsersRow;
    punches: Punch[];
    settings: Settings;

    constructor(name: string, slack: string, salary: boolean, timetable: Timetable, row: Rows.UsersRow = null) {
        this.realName = name;
        this.slackName = slack;
        this.slackId = null;
        this.salary = salary;
        this.timetable = timetable;
        this.row = row;
        this.punches = [];
        this.settings = Settings.fromSettings();
    }
    static parse(row: Rows.UsersRow) {
        const timetable = new Timetable(row.start, row.end, row.timezone);
        timetable.setVacation(row.vacationLogged, row.vacationAvailable);
        timetable.setSick(row.sickLogged, row.sickAvailable);
        timetable.unpaidTotal = +row.unpaidLogged;
        timetable.loggedTotal = +row.totalLogged;
        timetable.averageLogged = +row.averageLogged;
        const user = new User(row.name, row.slackname, (row.salary === 'Y'), timetable, row);
        let lastPing;
        if (row.lastPing && row.lastPing.length !== 0) {
            lastPing = moment.tz(row.lastPing, 'MM/DD/YYYY h:mm:ss A', row.timezone);
        } else {
            lastPing = moment.tz(row.timezone);
        }
        user.settings = Settings.fromSettings({
            shouldHound: row.shouldHound === 'Y',
            shouldResetHound: +row.houndFrequency !== -1,
            houndFrequency: row.houndFrequency || 0,
            lastMessage: null,
            lastPing
        });
        return user;
    }
    get activeHours(): [moment.Moment, moment.Moment] {
        return this.timetable.activeHours();
    }
    get activeTime(): number {
        return this.timetable.activeTime();
    }
    setTimezone(timezone) {
        const tz = moment.tz.zone(timezone);
        if (tz) {
            this.timetable.timezone = tz;
            this.updateRow();
        }
        return tz;
    }
    setStart(start) {
        const time = moment(start, 'h:mm A');
        if (time) {
            this.timetable.start = time;
            this.updateRow();
        }
        return time;
    }
    setEnd(end) {
        const time = moment(end, 'h:mm A');
        if (time) {
            this.timetable.end = time;
            this.updateRow();
        }
        return time;
    }
    toDays(hours) {
        return this.timetable.toDays(hours);
    }
    isInactive(current?: moment.Moment, ignoreHolidays = false) {
        current = current || moment.tz(this.timetable.timezone.name);
        const [start, end] = this.activeHours;
        if (holidayForMoment(current) && !ignoreHolidays) {
            return true;
        } else if (current.isBetween(start, end)) {
            return false;
        }
        return true;
    }

    lastPunch(modes?: Mode | Mode[]): Punch {
        if (!modes) {
            modes = MODES as Mode[];
        } else if (typeof modes === 'string') {
            modes = [modes]
        }
        if (this.punches && this.punches.length > 0) {
            for (let len = this.punches.length, i = len - 1; i >= 0; --i) {
                const last = this.punches[i];
                if (modes.indexOf(last.mode) !== -1) {
                    return last;
                }
            }
        }
        return null;
    }

    lastPunchTime() {
        if (this.punches.length > 0) {
            const punch = this.lastPunch();
            if (punch.times.length > 0) {
                const time = punch.times.slice(-1)[0];
                let date;
                if (time.isSame(moment(), 'day')) {
                    date = 'today';
                } else if (time.isSame(moment().subtract(1, 'days'), 'day')) {
                    date = 'yesterday';
                } else {
                    date = 'on ' + time.format('MMM Do');
                }
                return `${date}, ${time.format('h:mm a')}`;
            } else if (punch.times.block) {
                let type;
                if (punch.mode === 'none') {
                    type = ' ';
                } else if (punch.mode === 'vacation' || punch.mode === 'sick' || punch.mode === 'unpaid') {
                    type = punch.mode + ' ';
                }
                return `a ${punch.times.block} hour ${type}block punch`;
            }
        }
        return 'never';
    }

    async undoPunch() {
        const lastPunch = this.lastPunch();
        console.log(`Undoing ${this.slackName}'s punch: ${lastPunch.description(this)}'`);
        let elapsed;
        if (lastPunch.times.block) {
            elapsed = lastPunch.times.block;
        } else {
            elapsed = lastPunch.elapsed || 0;
        }
        if (lastPunch.mode === 'vacation' || lastPunch.mode === 'sick' || lastPunch.mode === 'unpaid' || lastPunch.mode === 'none') {
            await lastPunch.row.del();
            const punch = this.punches.pop();
            const elapsedDays = this.toDays(elapsed);
            if (punch.mode === 'vacation') {
                const total = this.timetable.vacationTotal;
                const available = this.timetable.vacationAvailable;
                this.timetable.setVacation(total - elapsedDays, available + elapsedDays);
            } else if (punch.mode === 'sick') {
                const total = this.timetable.sickTotal;
                const available = this.timetable.sickAvailable;
                this.timetable.setSick(total - elapsedDays, available + elapsedDays);
            } else if (punch.mode === 'unpaid') {
                const total = this.timetable.unpaidTotal;
                this.timetable.unpaidTotal = total - elapsedDays;
            } else {
                const logged = this.timetable.loggedTotal;
                this.timetable.loggedTotal = logged - elapsed;
            }
            return punch;
        } else if (lastPunch.mode === 'out') {
            lastPunch.times.pop();
            lastPunch.elapsed = null;

            const lineBreakIndex = lastPunch.notes.lastIndexOf('\n');
            if (lineBreakIndex > 0) {
                lastPunch.notes = lastPunch.notes.substring(0, lineBreakIndex);
            }

            lastPunch.mode = 'in';
            lastPunch.row.out = lastPunch.row.totalTime = lastPunch.row.blockTime = '';
            lastPunch.row.notes = lastPunch.notes;

            await lastPunch.row.save();
            const logged = this.timetable.loggedTotal;
            this.timetable.loggedTotal = logged - elapsed;

            return lastPunch;
        } else if (lastPunch.mode === 'in') {
            await lastPunch.row.del();

            const punch = this.punches.pop();
            return punch;
        }
        return null;
    }

    toRawPayroll(start, end) {
        let row = Rows.PayrollReportsRow.create({
            values: [],
            range: ''
        });

        row.date = moment.tz(TIMEZONE).format('M/DD/YYYY');
        row.name = this.realName;
        let loggedTime = 0,
            unpaidTime = 0,
            vacationTime = 0,
            sickTime = 0;
        const projectsForPeriod = [];
        for (let punch of this.punches) {
            if (punch.date.isBefore(start) || punch.date.isAfter(end)) {
                continue;
            } else if (!punch.elapsed && !punch.times.block) {
                continue;
            } else if (punch.mode === 'in') {
                continue;
            } else if (punch.mode === 'vacation') {
                if (punch.times.block) {
                    vacationTime += punch.times.block;
                } else {
                    vacationTime += punch.elapsed;
                }
            } else if (punch.mode === 'unpaid') {
                if (punch.times.block) {
                    unpaidTime += punch.times.block;
                } else {
                    unpaidTime += punch.elapsed;
                }
            } else if (punch.mode === 'sick') {
                if (punch.times.block) {
                    sickTime += punch.times.block;
                } else {
                    sickTime += punch.elapsed;
                }
            } else {
                if (punch.times.block) {
                    loggedTime += punch.times.block;
                } else {
                    loggedTime += punch.elapsed;
                }
            }
            if (punch.projects && punch.projects.length > 0) {
                for (let project of punch.projects) {
                    const match = projectsForPeriod.filter((item, index, arr) => {
                        return project.name === item.name;
                    })[0];
                    if (!match) {
                        projectsForPeriod.push(project);
                    }
                }
            }
        }

        loggedTime = +loggedTime.toFixed(2);
        vacationTime = +vacationTime.toFixed(2);
        sickTime = +sickTime.toFixed(2);
        unpaidTime = +unpaidTime.toFixed(2);

        if (this.salary) {
            row.paid = (80 - unpaidTime).toString();
        } else {
            row.paid = (loggedTime + vacationTime + sickTime).toString();
        }

        row.unpaid = unpaidTime.toString();
        row.logged = loggedTime.toString();
        row.vacation = vacationTime.toString();
        row.sick = sickTime.toString();
        row.overtime = Math.max(0, loggedTime - 80).toString();
        row.holiday = (this.timetable.holiday || 0).toString();
        row.extra = {
            slack: this.slackName,
            projects: projectsForPeriod
        };
        return row;
    }
    async updateRow() {
        if (this.row) {
            this.row.start = this.timetable.start.format('h:mm A');
            this.row.end = this.timetable.end.format('h:mm A');
            this.row.timezone = this.timetable.timezone.name;
            this.row.shouldHound = this.settings.shouldHound ? 'Y' : 'N';
            this.row.houndFrequency = (this.settings.houndFrequency ? this.settings.houndFrequency : -1).toString();
            this.row.vacationAvailable = this.timetable.vacationAvailable.toString();
            this.row.vacationLogged = this.timetable.vacationTotal.toString();
            this.row.sickAvailable = this.timetable.sickAvailable.toString();
            this.row.sickLogged = this.timetable.sickTotal.toString();
            this.row.unpaidLogged = this.timetable.unpaidTotal.toString();
            this.row.overtime = Math.max(0, this.timetable.loggedTotal - 80).toString();
            this.row.totalLogged = this.timetable.loggedTotal.toString();
            this.row.averageLogged = this.timetable.averageLogged.toString();
            if (this.settings.lastPing) {
                this.row.lastPing = moment.tz(this.settings.lastPing, this.timetable.timezone.name).format('MM/DD/YYYY hh:mm:ss A');
            } else {
                this.row.lastPing = moment.tz(this.timetable.timezone.name).format('MM/DD/YYYY hh:mm:ss A');
            }
            try {
                await this.row.save();
            } catch (err) {
                throw err;
            }
        } else {
            throw new Error('Row is null');
        }
    }
    directMessage(msg: string, attachment?: any) {
        Slack.logDM(msg, this.slackId, attachment);
    }
    hound(msg: string) {
        const now = moment.tz(TIMEZONE);
        this.settings.lastPing = now;
        if (!this.salary && this.settings.houndFrequency > 0) {
            msg = `You have been on the clock for ${this.settings.houndFrequency} hours.\n` + msg;
        }
        setTimeout(() => this.directMessage(msg), 1000 * (Math.floor(Math.random() * 3) + 1));
        console.log(`Hounded ${this.slackName} with '${msg}'`);
        this.updateRow();
    }
    hexColor() {
        const hash = this.slackName.split('')
            .reduce((acc, char) => char.charCodeAt(0) + ((acc << 3) - acc), 0);
        const color = Math.abs(hash).toString(16).substring(0, 6);
        const hexColor = "#" + '000000'.substring(0, 6 - color.length) + color;
        return hexColor;
    }
    slackAttachment() {
        const fields = [];
        const statusString = `${this.salary ? 'Salary' : 'Hourly'} - Active ${this.timetable.start.format('h:mm a')} to ${this.timetable.end.format('h:mm a z')}`;
        const lastPunch = this.lastPunch();
        if (lastPunch) {
            const lastPunchField = {
                title: 'Last Punch',
                value: `${lastPunch.description(this)}`,
                short: true
            };
            fields.push(lastPunchField);
        }
        let houndString = `${this.settings.shouldHound ? 'On' : 'Off'}`;
        if (this.settings.shouldHound) {
            houndString += ` (${this.settings.houndFrequency} hours)`
        }
        const houndField = {
            title: "Hounding",
            value: houndString,
            short: true
        };
        fields.push(houndField);
        if (this.salary) {
            const vacationDaysField = {
                title: "Vacation Days",
                value: `${this.timetable.vacationAvailable} available, ${this.timetable.vacationTotal} used`,
                short: true
            };
            fields.push(vacationDaysField)
            const sickDaysField = {
                title: "Sick Days",
                value: `${this.timetable.sickAvailable} available, ${this.timetable.sickTotal} used`,
                short: true
            };
            fields.push(sickDaysField)
        }
        if (this.timetable.unpaidTotal > 0) {
            const unpaidField = {
                title: "Unpaid Days",
                value: `${this.timetable.unpaidTotal} used`,
                short: true
            };
            fields.push(unpaidField);
        }
        const attachment = {
            title: this.realName + ' (@' + this.slackName + ')',
            text: statusString,
            fallback: this.realName.replace(/\W/g, '') + ' @' + this.slackName.replace(/\W/g, ''),
            color: this.hexColor(),
            fields
        };
        return attachment;
    }
    description() {
        return `User: ${this.realName} (${this.slackName})\nThey have ${(this.punches || []).length} punches on record\nLast punch was ${this.lastPunchTime()}\nTheir active hours are from ${this.timetable.start.format('h:mm a')} to ${this.timetable.end.format('h:mm a')}\nThey are in ${this.timetable.timezone.name}\nThe last time they sent a message was ${+(moment.tz(TIMEZONE).diff(this.settings.lastMessage && this.settings.lastMessage.time, 'hours', true).toFixed(2))} hours ago`;
    }
}