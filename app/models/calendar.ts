'use strict';

import moment from 'moment';

import { HEADERS, TIMEZONE } from '../shared/constants';
import Logger from '../logger';

export class Calendar {
  vacation: any;
  sick: any;
  holidays: any;
  referencePayWeek: any;
  events: any;
  constructor(vacation: any, sick: any, holidays: any, referencePayWeek: any, events: any) {
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
  description() {
    let str = "Organization calendar:\n"
    for (let holiday of this.holidays) {
      str += `This year's ${holiday.name} is on ${holiday.date.format('MM/DD/YYYY')}\n`;
    }
    return str;
  }
}

export class CalendarEvent {
  date: moment.Moment;
  name: any;
  row: any;
  constructor(date: moment.Moment, name: any, row?: any) {
    this.date = date;
    this.name = name;
    this.row = row;
  }
  static parse(row: any): CalendarEvent {
    if (!row) {
      return;
    }
    const headers = HEADERS.events;
    let date, name;
    if (row[headers.date]) {
      date = moment(row[headers.date], 'MM/DD/YYYY');
    }
    if (row[headers.name]) {
      name = row[headers.name].trim();
    }
    const newEvent = new CalendarEvent(date, name, row);
    return newEvent;
  }
  daysUntil(): number {
    return this.date.diff(moment(), 'days');
  }
  toEventRow() {
    const headers = HEADERS.events;
    const row = this.row || {};
    row[headers.date] = row[headers.date] || this.date.format('MM/DD/YYYY');
    row[headers.name] = row[headers.name] || this.name;
    return row;
  }
  async updateRow() {
    return new Promise<void>((resolve, reject) => {
      if (this.row) {
        const headers = HEADERS.events;
        this.row[headers.date] = this.date.format('MM/DD/YYYY');
        this.row[headers.name] = `#${this.name}`;
        this.row.save((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        reject('Row is null');
      }
    });
  }
  description() {
    return `Calendar Event: ${this.name}\Date: ${this.date.format('MM/DD/YYYY')}`;
  }
}
