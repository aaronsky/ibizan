
import 'mocha';
const { expect } = require('chai');
import * as moment from 'moment-timezone';

const { MockSheet } = require('../../../test/mocks');
const TEST_ROW = require('../../../test/mocks/mocked/mocked_users')[0];

import { Rows } from '../rows';
import { User, Timetable } from '../user';

describe('Timetable', () => {
  beforeEach(() => {
    const start = moment({
      day: 3,
      hour: 7
    });
    const end = moment({
      day: 3,
      hour: 18
    });
    this.timetable = new Timetable(start, end, 'America/New_York');
  });
  describe('#setVacation(total, available)', () => {
    it('should change the underlying values', () => {
      this.timetable.setVacation(85);
      expect(this.timetable.vacationTotal).to.equal(85);
    });
    it('should only take numbers', () => {
      const notNumber: any = 'ghosts';
      this.timetable.setVacation(notNumber);
      expect(this.timetable.vacationTotal).to.equal(0);
    });
    it('should only take positive numbers', () => {
      this.timetable.setVacation(-85);
      expect(this.timetable.vacationTotal).to.equal(0);
    });
    it('should handle less than two arguments gracefully', () => {
      this.timetable.setVacation(null);
      expect(this.timetable.vacationTotal).to.equal(0);
    });
  });
  describe('#setSick(total, available)', () => {
    it('should change the underlying values', () => {
      this.timetable.setSick(85);
      expect(this.timetable.sickTotal).to.equal(85);
    });
    it('should only take numbers', () => {
      const notNumber: any = 'ghosts';
      this.timetable.setSick(notNumber);
      expect(this.timetable.sickTotal).to.equal(0);
    });
    it('should only take positive numbers', () => {
      this.timetable.setSick(-85);
      expect(this.timetable.sickTotal).to.equal(0);
    });
    it('should handle less than two arguments gracefully', () => {
      this.timetable.setSick(null);
      expect(this.timetable.sickTotal).to.equal(0);
    });
  });
  describe('#set unpaidTotal(total)', () => {
    it('should change the underlying values', () => {
      this.timetable.unpaidTotal = 85;
      expect(this.timetable.unpaidTotal).to.equal(85);
    });
    it('should only take numbers', () => {
      const notNumber: any = 'ghosts';
      this.timetable.unpaidTotal = notNumber;
      expect(this.timetable.unpaidTotal).to.equal(0);
    });
    it('should only take positive numbers', () => {
      this.timetable.unpaidTotal = -85;
      expect(this.timetable.unpaidTotal).to.equal(0);
    });
    it('should handle less than two arguments gracefully', () => {
      this.timetable.unpaidTotal = null;
      expect(this.timetable.unpaidTotal).to.equal(0);
    });
  });
  describe('#set loggedTotal(total)', () => {
    it('should change the underlying values', () => {
      this.timetable.loggedTotal = 85;
      expect(this.timetable.loggedTotal).to.equal(85);
    });
    it('should only take numbers', () => {
      const notNumber: any = 'ghosts';
      this.timetable.loggedTotal = notNumber;
      expect(this.timetable.loggedTotal).to.equal(0);
    });
    it('should only take positive numbers', () => {
      this.timetable.loggedTotal = -85;
      expect(this.timetable.loggedTotal).to.equal(0);
    });
    it('should handle less than two arguments gracefully', () => {
      this.timetable.loggedTotal = null;
      expect(this.timetable.loggedTotal).to.equal(0);
    });
  });
  describe('#set averageLogged(total)', () => {
    it('should change the underlying values', () => {
      this.timetable.averageLogged = 85;
      expect(this.timetable.averageLogged).to.equal(85);
    });
    it('should only take numbers', () => {
      const notNumber: any = 'ghosts';
      this.timetable.averageLogged = notNumber;
      expect(this.timetable.averageLogged).to.equal(0);
    });
    it('should only take positive numbers', () => {
      this.timetable.averageLogged = -85;
      expect(this.timetable.averageLogged).to.equal(0);
    });
    it('should handle less than two arguments gracefully', () => {
      this.timetable.averageLogged = null;
      expect(this.timetable.averageLogged).to.equal(0);
    });
  });
});

describe('User', () => {
  beforeEach(() => {
    const start = moment({
      day: 3,
      hour: 7
    }).format('hh:mm a');
    const end = moment({
      day: 3,
      hour: 18
    }).format('hh:mm a');
    const timetable = new Timetable(start, end, 'America/New_York');
    this.user = new User('Jimmy Hendricks', 'jeff', false, timetable);
  });
  describe('.parse(row)', () => {
    it('should return a new User when given a row', () => {
      const row = Rows.UsersRow.create({ values: TEST_ROW, range: '' });
      row.bindGoogleApis(MockSheet.service, '', MockSheet.auth);
      const user = User.parse(row);
      expect(user).to.exist;
    });
  });
  describe('#get activeHours()', () => {
    it('should return an array', () => {
      expect(this.user.activeHours).to.be.instanceof(Array);
    });
    it('should return an array of two dates', () => {
      const dates = this.user.activeHours;
      expect(dates).to.have.length(2);
      const date0 = dates[0];
      expect(date0).to.exist;
      expect(date0.toDate()).to.be.an.instanceof(Date);
      const date1 = dates[1];
      expect(date1).to.exist;
      expect(date1.toDate()).to.be.an.instanceof(Date);
    });
    it('should return the start and end times', () => {
      const dates = this.user.activeHours;
      expect(dates).to.have.deep.property('[0]', this.user.timetable.start);
      expect(dates).to.have.deep.property('[1]', this.user.timetable.end);
    });
  });
  describe('#get activeTime()', () => {
    it('should return the elapsed time between start and end', () => {
      const elapsed = this.user.activeTime;
      expect(elapsed).to.be.a.Number;
      expect(elapsed).to.equal(8);
    });
  });
  describe('#setTimezone(timezone)', () => {

  });
  describe('#setStart(start)', () => {

  });
  describe('#setEnd(end)', () => {

  });
  describe('#toDays(hours)', () => {

  });
  describe('#isInactive(current?, ignoreHolidays?)', () => {
    it('should be true when it is earlier than the start time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(start).subtract(2, 'hours');
      expect(this.user.isInactive(time, true)).to.be.true;
    });
    it('should be true when it is later than the end time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(end).add(2, 'hours');
      expect(this.user.isInactive(time, true)).to.be.true;
    });
    it('should be false when it is in between the start and end time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(start).add(end.diff(start, 'hours') / 2, 'hours');
      expect(this.user.isInactive(time, true)).to.be.false;
    });
  });
  describe('#lastPunch(modes?)', () => {

  });
  describe('#lastPunchTime()', () => {

  });
  describe('#undoPunch()', () => {

  });
  describe('#toRawPayroll(start, end)', () => {
    it('should return a description of the project for output', () => {
      const payrollRow = this.user.toRawPayroll();
      expect(payrollRow).to.exist;
    });
  });
  describe('#updateRow()', () => {

  });
  describe('#directMessage(msg, logger, attachment?)', () => {

  });
  describe('#hound(msg, logger)', () => {

  });
  describe('#slackAttachment()', () => {

  });
  describe('#description()', () => {
    it('should return a description of the project for output', () => {
      const description = this.user.description();
      expect(description).to.exist;
    });
  });
});