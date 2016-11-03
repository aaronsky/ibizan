import * as console from 'console';

import * as moment from 'moment';

import { Rows } from '../shared/rows';

export class Project {
  readonly name: string;
  readonly start: any;
  total: any;
  row: Rows.ProjectsRow;
  constructor(name: string, start: any, total: any, row: Rows.ProjectsRow = null) {
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
        total = parseInt(row.total);
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
  description() {
    return `Project: ${this.name}\nStart date: ${this.start.format('MM/DD/YYYY')}\nTotal hours: ${this.total}`;
  }
}