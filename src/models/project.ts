
import * as moment from 'moment';

import { HEADERS } from '../helpers/constants';

export default class Project {
  name: string;
  start: any;
  total: any;
  row: any;
  constructor(name: string, start: any, total: any, row: any = null) {
    this.name = name.replace('#', '');
    this.start = start;
    this.total = total;
    this.row = row;
  }
  static parse(row) {
    if (!row) {
      return;
    }
    const headers = HEADERS.projects;
    let name, startDate, total;
    if (row[headers.name]) {
      name = row[headers.name];
    }
    if (row[headers.start]) {
      startDate = moment(row[headers.start], 'MM/DD/YYYY');
    }
    if (row[headers.total]) {
      total = 0;
      if (!isNaN(row[headers.total])) {
        total = parseInt(row[headers.total]);
      }
    }
    const project = new Project(name, startDate, total, row);
    return project;
  }
  async updateRow() {
    return new Promise<void>((resolve, reject) => {
      if (this.row) {
        const headers = HEADERS.projects;
        this.row[headers.name] = `#${this.name}`;
        this.row[headers.start] = this.start.format('MM/DD/YYYY');
        this.row[headers.total] = Math.floor(this.total);
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
    return `Project: ${this.name}\nStart date: ${this.start.format('MM/DD/YYYY')}\nTotal hours: ${this.total}`;
  }
}