
import * as moment from 'moment';

import { TIMEZONE } from '../shared/constants';
import { Rows } from '../shared/rows';

export class Calendar {
  vacation: number;
  sick: number;
  holidays: {
    name: string;
    date: moment.Moment;
  }[];
  referencePayWeek: moment.Moment;
  events: CalendarEvent[];
  constructor(vacation: number, sick: number, holidays: { name: string, date: moment.Moment }[], referencePayWeek: moment.Moment, events: CalendarEvent[]) {
    this.vacation = vacation;
    this.sick = sick;
    this.holidays = holidays;
    this.referencePayWeek = referencePayWeek;
    this.events = events;
  }
  isPayWeek() {
    return (moment().diff(this.referencePayWeek, 'weeks') % 2) == 0;
  }
  upcomingEvents(date = moment()) {
    this.events.sort((a, b) => {
      return moment.utc(a.date).diff(moment.utc(b.date));
    });
    const upcomingEvents = [];
    for (let event of this.events) {
      if (event.date.isAfter(date)) {
        upcomingEvents.push(event);
      }
    }
    return upcomingEvents;
  }
  hexColor() {
    let hash = 0;
    for (let i = 0, len = this.holidays.length; i < len; i++) {
      hash = this.holidays[i].name.charCodeAt(i) + ((hash << 3) - hash);
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    const hexColor = "#" + '000000'.substring(0, 6 - color.length) + color;
    return hexColor;
  }
  slackAttachment() {
    const fields = [];
    for (let holiday of this.holidays) {
      fields.push({
        title: holiday.name,
        value: holiday.date.format('MM/DD/YYYY'),
        short: true
      });
    }
    const attachment = {
      color: this.hexColor(),
      fields
    };
    return attachment;
  }
  description() {
    let str = "Organization calendar:\n"
    for (let holiday of this.holidays) {
      str += `This year's ${holiday.name} is on ${holiday.date.format('MM/DD/YYYY')}\n`;
    }
    return str;
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
      return;
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
    const row = this.row || new Rows.EventsRow([], '');
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
      throw 'Row is null';
    }
  }
  description() {
    return `Calendar Event: ${this.name}\Date: ${this.date.format('MM/DD/YYYY')}`;
  }
}
