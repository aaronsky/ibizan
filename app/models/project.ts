import * as moment from 'moment';

import { Rows } from './rows';

export class Project {
  readonly name: string;
  readonly start: moment.Moment;
  total: number;
  row: Rows.ProjectsRow;
  constructor(name: string, start: moment.Moment, total: number, row: Rows.ProjectsRow = null) {
    this.name = name.replace('#', '');
    this.start = start;
    this.total = total;
    this.row = row;
  }
  static parse(row: Rows.ProjectsRow) {
    if (!row) {
      return;
    }
    let name, startDate, total;
    if (row.name) {
      name = row.name;
    }
    if (row.start) {
      startDate = moment(row.start, 'MM/DD/YYYY');
    }
    if (row.total) {
      total = 0;
      if (!isNaN(+row.total)) {
        total = +row.total;
      }
    }
    const project = new Project(name, startDate, total, row);
    return project;
  }
  async updateRow() {
    if (this.row) {
      this.row.name = `#${this.name}`;
      this.row.start = this.start.format('MM/DD/YYYY');
      this.row.total = Math.floor(this.total).toString();
      try {
        await this.row.save();
      } catch (err) {
        throw err;
      }
      return;
    } else {
      throw 'Row is null';
    }
  }
  hexColor() {
    let hash = 0;
    for (let i = 0, len = this.name.length; i < len; i++) {
      hash = this.name.charCodeAt(i) + ((hash << 3) - hash);
    }
    const color = Math.abs(hash).toString(16).substring(0, 6);
    const hexColor = "#" + '000000'.substring(0, 6 - color.length) + color;
    return hexColor;
  }
  slackAttachment() {
    const attachment = {
      title: this.name,
      text: `Started on ${this.start.format('MM/DD/YYYY')}`,
      color: this.hexColor(),
      fields: [
        {
          title: 'Total hours',
          value: `${this.total} hours`,
          short: true
        }
      ]
    };
    return attachment;
  }
  description() {
    return `Project: ${this.name}\nStart date: ${this.start.format('MM/DD/YYYY')}\nTotal hours: ${this.total}`;
  }
}