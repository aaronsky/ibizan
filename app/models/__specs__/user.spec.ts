import * as moment from 'moment-timezone';

import User, { Timetable } from '../user';

describe('Timetable', () => {
  function testValidateSetValues(timetable: Timetable, mode: string, total: number, expectedTotal: number, available?: number, expectedAvailable?: number) {
    timetable['set' + mode.charAt(0).toUpperCase() + mode.substring(1)](total, available);
    expect(timetable[mode + 'Total']).to.equal(expectedTotal);
    if (available && expectedAvailable) {
      expect(timetable[mode + 'Available']).to.equal(expectedAvailable);
    }
  };
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
    const mode = 'vacation';
    it('should change the underlying values', () => testValidateSetValues(this.timetable, mode, 85, 85));
    it('should only take numbers', () => testValidateSetValues(this.timetable, mode, 'ghosts', 0));
    it('should only take positive numbers', () => testValidateSetValues(this.timetable, mode, -85, 0));
    it('should handle less than two arguments gracefully', () => testValidateSetValues(this.timetable, mode, null, 0));
  });
  describe('#setSick(total, available)', () => {
    const mode = 'sick';
    it('should change the underlying values', () => testValidateSetValues(this.timetable, mode, 85, 85));
    it('should only take numbers', () => testValidateSetValues(this.timetable, mode, 'ghosts', 0));
    it('should only take positive numbers', () => testValidateSetValues(this.timetable, mode, -85, 0));
    it('should handle less than two arguments gracefully', () => testValidateSetValues(this.timetable, mode, null, 0));
  });
  describe('#setUnpaid(total)', () => {
    const mode = 'unpaid';
    it('should change the underlying values', () => testValidateSetValues(this.timetable, mode, 85, 85));
    it('should only take numbers', () => testValidateSetValues(this.timetable, mode, 'ghosts', 0));
    it('should only take positive numbers', () => testValidateSetValues(this.timetable, mode, -85, 0));
    it('should handle less than two arguments gracefully', () => testValidateSetValues(this.timetable, mode, null, 0));
  });
  describe('#setLogged(total)', () => {
    const mode = 'logged';
    it('should change the underlying values', () => testValidateSetValues(this.timetable, mode, 85, 85));
    it('should only take numbers', () => testValidateSetValues(this.timetable, mode, 'ghosts', 0));
    it('should only take positive numbers', () => testValidateSetValues(this.timetable, mode, -85, 0));
    it('should handle less than two arguments gracefully', () => testValidateSetValues(this.timetable, mode, null, 0));
  });
  describe('#setAverageLogged(total)', () => {
    const mode = 'averageLogged';
    it('should change the underlying values', () => testValidateSetValues(this.timetable, mode, 85, 85));
    it('should only take numbers', () => testValidateSetValues(this.timetable, mode, 'ghosts', 0));
    it('should only take positive numbers', () => testValidateSetValues(this.timetable, mode, -85, 0));
    it('should handle less than two arguments gracefully', () => testValidateSetValues(this.timetable, mode, null, 0));
  });
});

const TEST_ROW = require('../../../test/mocks/mocked/mocked_employees')[0];

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
      const user = User.parse(TEST_ROW);
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
      expect(dates).to.have.deep.property('[0]').that.is.an.instanceof(moment.Moment);
      expect(dates).to.have.deep.property('[1]').that.is.an.instanceof(moment.Moment);
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
  describe('#isInactive(current?)', () => {
    it('should be true when it is earlier than the start time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(start).subtract(2, 'hours');
      expect(this.user.isInactive(time)).to.be.true;
    });
    it('should be true when it is later than the end time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(end).add(2, 'hours');
      expect(this.user.isInactive(time)).to.be.true;
    });
    it('should be false when it is in between the start and end time', () => {
      const [start, end] = this.user.activeHours;
      const time = moment(start).add(end.diff(start, 'hours') / 2, 'hours');
      expect(this.user.isInactive(time)).to.be.false;
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