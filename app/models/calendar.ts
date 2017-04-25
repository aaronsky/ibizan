
import * as moment from 'moment';

import { TIMEZONE } from '../shared/constants';
import { PayrollConfig } from '../config';
import Copy from '../i18n';
import { Rows } from '../models/rows';

export interface Holiday {
    name: string;
    date: moment.Moment;
}

export class Calendar {
    vacation: number;
    sick: number;
    holidays: Holiday[];
    payroll: PayrollConfig;
    events: CalendarEvent[];

    constructor(vacation: number, sick: number, holidays: Holiday[], events: CalendarEvent[]) {
        this.vacation = vacation;
        this.sick = sick;
        this.holidays = holidays;
        this.events = events;
    }

    isPayWeek() {
        return (moment().diff(this.payroll.referenceDate, 'weeks') % this.payroll.period) == 0;
    }

    upcomingEvents(date = moment()) {
        this.events.sort((a, b) => {
            return moment.utc(a.date).diff(moment.utc(b.date));
        });
        return this.events.reduce((acc, event) => {
            if (event.date.isAfter(date)) {
                return [...acc, event];
            }
            return acc;
        }, []);
    }

    hexColor() {
        const hash = this.holidays.reduce((acc, holiday, index) => {
            return holiday.name.charCodeAt(index) + ((acc << 3) - acc);
        }, 0);
        const color = Math.abs(hash).toString(16).substring(0, 6);
        const hexColor = "#" + '000000'.substring(0, 6 - color.length) + color;
        return hexColor;
    }

    slackAttachment() {
        return {
            color: this.hexColor(),
            fields: this.holidays.map(holiday => {
                return {
                    title: holiday.name,
                    value: holiday.date.format('MM/DD/YYYY'),
                    short: true
                }
            })
        };
    }

    description(locale?: string) {
        return Copy.forLocale(locale).calendar.description(this.holidays);
    }
}

export class CalendarEvent {
    readonly date: moment.Moment;
    readonly name: string;
    row: Rows.EventsRow;

    constructor(date: moment.Moment, name: string, row?: Rows.EventsRow) {
        this.date = date;
        this.name = name;
        this.row = row;
    }

    static parse(row: Rows.EventsRow): CalendarEvent {
        if (!row) {
            return null;
        }
        let date, name;
        if (row.date) {
            date = moment(row.date, 'MM/DD/YYYY');
        }
        if (row.name) {
            name = row.name.trim();
        }
        const newEvent = new CalendarEvent(date, name, row);
        return newEvent;
    }

    daysUntil(): number {
        return this.date.diff(moment(), 'days');
    }

    toEventRow() {
        const row = this.row || Rows.EventsRow.create({
            values: [],
            range: ''
        });
        row.date = row.date || this.date.format('MM/DD/YYYY');
        row.name = row.name || this.name;
        return row;
    }

    async updateRow() {
        if (this.row) {
            this.row.date = this.date.format('MM/DD/YYYY');
            this.row.name = `#${this.name}`;
            try {
                await this.row.save();
                return;
            } catch (err) {
                throw err;
            }
        } else {
            throw new Error('Row is null');
        }
    }

    description(locale?: string) {
        return Copy.forLocale(locale).calendar.eventDescription(this.name, this.date);
    }
}
