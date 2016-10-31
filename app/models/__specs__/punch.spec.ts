
import 'mocha';
const { expect } = require('chai');
import * as moment from 'moment';

const { MockConfig, MockSheet } = require('../../../test/mocks');

import { Rows } from '../../shared/rows';
import { Organization } from '../organization';
import { Project } from '../project';
import { User, Timetable } from '../user';
import { Punch } from '../punch';

const org = new Organization(MockConfig);
org.projects = [
  new Project('#production', moment(), 0),
  new Project('#camp-fangamer', moment(), 0)
];
org.spreadsheet.sheet = MockSheet;

describe('Punch', () => {
  describe('#constructor(mode, times, projects, notes)', () => {

  });
  describe('.parse(user, command, mode, timezone?)', () => {
    beforeEach(() => {
      const start = moment({
        day: 3, 
        hour: 7
      });
      const end = moment({
        day: 3, 
        hour: 18
      });
      const timetable = new Timetable(start, end, moment.tz.zone('America/New_York'));
      timetable.setVacation(13, 0);
      timetable.setSick(5, 0);
      timetable.unpaidTotal = 0;
      timetable.loggedTotal = 0;
      timetable.averageLogged = 0;
      this.user = new User('Aaron Sky', 'aaronsky', true, timetable);
      this.projectName = 'production';
      this.alternateProject = 'camp-fangamer';
    });
    it('should return if user and command are not defined', () => {
      expect(Punch.parse(null, 'a dumb command')).to.be.undefined
      expect(Punch.parse(this.user, null)).to.be.undefined
    });
    it('in without arguments', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('out without arguments', () => {
      const punch = Punch.parse(this.user, 'out', 'out');
      expect(punch).to.have.property('mode', 'out');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in without arguments (title-case)', () => {
      const punch = Punch.parse(this.user, 'In', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('out without arguments (title-case)', () => {
      const punch = Punch.parse(this.user, 'Out', 'out');
      expect(punch).to.have.property('mode', 'out');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in with an existing project', () => {
      const punch = Punch.parse(this.user, `in #${this.projectName}`, 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.deep.property('projects[0]');
      expect(punch).to.have.deep.property('projects[0].name', this.projectName);
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('out with two existing projects', () => {
      const punch = Punch.parse(this.user, `out #${this.projectName} #${this.alternateProject}`, 'out');
      expect(punch).to.have.property('mode', 'out');
      expect(punch).to.have.deep.property('times[0]');
      expect(punch).to.have.deep.property('projects[0]');
      expect(punch).to.have.deep.property('projects[0].name', this.projectName);
      expect(punch).to.have.deep.property('projects[1]');
      expect(punch).to.have.deep.property('projects[1].name', this.alternateProject);
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in at a time without a period marker', () => {
      const punch = Punch.parse(this.user, 'in 9:15', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      const now = moment();
      const amPm = now.format('A');
      const expectedTime = moment(`9:15 #{amPm}`, 'h:mm A');
      if (expectedTime.isAfter(now) && expectedTime.diff(now, 'hours', true) > 6) {
        expectedTime.subtract(12, 'hours');
      }
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime.format('hh:mm:ss A'));
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in at a time with a period marker and no space between', () => {
      const punch = Punch.parse(this.user, 'in 9:15pm', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      const expectedTime = '09:15:00 PM';
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in at a time with a period marker', () => {
      const punch = Punch.parse(this.user, 'in 9:15 pm', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      const expectedTime = '09:15:00 PM';
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in at a full date', () => {
      const punch = Punch.parse(this.user, 'in 4pm 4/22/2016', 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      const expectedTime = '04:00:00 PM';
      const expectedDate = '04/22/2016';
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime);
      expect(punch.date.format('MM/DD/YYYY')).to.equal(expectedDate);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('out at a time without minutes yesterday', () => {
      const punch = Punch.parse(this.user, 'out 7pm yesterday', 'out');
      expect(punch).to.have.property('mode', 'out');
      expect(punch).to.have.deep.property('times[0]');
      const yesterday = moment().subtract(1, 'days');
      const expectedDate = yesterday.format('MM/DD/YYYY');
      const expectedTime = '07:00:00 PM';
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime);
      expect(punch.date.format('MM/DD/YYYY')).to.equal(expectedDate);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('in at a 24-hour time and an existing project', () => {
      const punch = Punch.parse(this.user, `in 17:00 #${this.projectName}`, 'in');
      expect(punch).to.have.property('mode', 'in');
      expect(punch).to.have.deep.property('times[0]');
      const expectedTime = '05:00:00 PM';
      expect(punch.times[0].format('hh:mm:ss A')).to.equal(expectedTime);
      expect(punch).to.have.deep.property('projects[0]');
      expect(punch).to.have.deep.property('projects[0].name', this.projectName);
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to punch', () => {
      const punch = Punch.parse(this.user, '1.5 hours');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 1.5);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('punch time block on day', () => {
      const punch = Punch.parse(this.user, '15 hours on 4/22');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 15);
      const expectedDate = '04/22/2016';
      expect(punch.date.format('MM/DD/YYYY')).to.equal(expectedDate);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to punch', () => {
      const punch = Punch.parse(this.user, '.5 hours');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 0.5);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to punch', () => {
      const punch = Punch.parse(this.user, '0.5 hours');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 0.5);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to punch', () => {
      const punch = Punch.parse(this.user, '0.5 hour');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 0.5);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to punch', () => {
      const punch = Punch.parse(this.user, '1 hour');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 1);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to yesterday\'s punch', () => {
      const punch = Punch.parse(this.user, '2 hours yesterday');
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 2);
      const yesterday = moment().subtract(1, 'days');
      const expectedDate = yesterday.format('MM/DD/YYYY');
      expect(punch.date.format('MM/DD/YYYY')).to.equal(expectedDate);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('append time block to Tuesday\'s punch and assign it to an existing project', () => {
      const punch = Punch.parse(this.user, `3.25 hours tuesday ${this.projectName}`);
      expect(punch).to.have.property('mode', 'none');
      expect(punch).to.have.deep.property('times.block', 3.25);
      expect(punch).to.have.deep.property('projects[0]');
      expect(punch).to.have.deep.property('projects[0].name', this.projectName);
      expect(punch.projects).to.be.empty;
    });
    it('flag today as vacation', () => {
      const punch = Punch.parse(this.user, 'vacation today', 'vacation');
      expect(punch).to.have.property('mode', 'vacation');
      expect(punch).to.have.property('times');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('flag half of today as sick', () => {
      const punch = Punch.parse(this.user, 'sick half-day', 'sick');
      expect(punch).to.have.property('mode', 'sick');
      expect(punch).to.have.property('times');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('flag half of yesterday as vacation', () => {
      const punch = Punch.parse(this.user, 'vacation half-day yesterday', 'vacation');
      expect(punch).to.have.property('mode', 'vacation');
      expect(punch).to.have.property('times');
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('flag a date range as sick', () => {
      const punch = Punch.parse(this.user, 'sick Jul 6-8', 'sick');
      expect(punch).to.have.property('mode', 'sick');
      expect(punch).to.have.property('times');
      expect(punch).to.have.deep.property('times.length', 2);
      expect(punch.elapsed).to.equal(33);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
    it('flag a date range as vacation', () => {
      const punch = Punch.parse(this.user, 'vacation 1/28 - 2/4', 'vacation');
      expect(punch).to.have.property('mode', 'vacation');
      expect(punch).to.have.property('times');
      expect(punch).to.have.deep.property('times.length', 2);
      expect(punch.elapsed).to.equal(72);
      expect(punch).to.have.property('projects');
      expect(punch.projects).to.be.empty;
      expect(punch).to.have.property('notes');
      expect(punch.notes).to.be.empty;
    });
  });
  describe('.parseRaw(user, row, spreadsheet, projects)', () => {

  });
  describe('#appendProjects(projects)', () => {

  });
  describe('#appendNotes(notes)', () => {

  });
  describe('#out(punch)', () => {
    beforeEach(() => {
      const zone = 'America/New_York';
      const now = moment.tz(zone);
      const start = moment.tz({
        year: now.year(), 
        month: now.month(), 
        day: now.date(), 
        hour: 7
      }, zone);
      const end = moment.tz({
        year: now.year(), 
        month: now.month(), 
        day: now.date(), 
        hour: 18
      }, zone);
      const timetable = new Timetable(start, end, zone);
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.unpaidTotal = 0;
      timetable.loggedTotal = 0;
      timetable.averageLogged = 0;
      this.user = new User('Aaron Sky', 'aaronsky', true, timetable);
    });
    it('should modify the punch to an out punch', () => {
      const [start, end] = this.user.activeHours;
      const punch = Punch.parse(this.user, `in ${start.format('hh:mma')} #production`, 'in');
      const outPunch = Punch.parse(this.user, `out ${start.format('hh:mma')} #camp-fangamer`, 'out');
      punch.out(outPunch);
      expect(punch.times).to.have.lengthOf(2);
      expect(punch.times[0].format()).to.equal(start.format());
      expect(punch.times[1].format()).to.equal(end.format());
      expect(punch.projects).to.have.lengthOf(2);
      expect(punch).to.have.deep.property('projects[0].name', 'production');
      expect(punch).to.have.deep.property('projects[1].name', 'camp-fangamer');
    });
  });
  describe('#toRawRow(name)', () => {
    beforeEach(() => {
      const start = moment({
        day: 3,
        hour: 7
      });
      const end = moment({
        day: 3,
        hour: 18
      });
      const timetable = new Timetable(start, end, moment.tz.zone('America/New_York'));
      timetable.setVacation(13, 0);
      timetable.setSick(5, 0);
      timetable.unpaidTotal = 0;
      timetable.loggedTotal = 0;
      timetable.averageLogged = 0;
      this.user = new User('Aaron Sky', 'aaronsky', true, timetable);
    });
    it('should return a raw object for use with Sheet', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      const raw = punch.toRawRow(this.user.name);
      expect(raw).to.exist
    });
    it('should return a raw object for an in punch', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      const raw = punch.toRawRow(this.user.name);
      expect(raw).to.exist
    });
    it('should return a raw object for an out punch', () => {
      const punch = Punch.parse(this.user, 'in 9:00am', 'in');
      const outPunch = Punch.parse(this.user, 'out 10:30am', 'out');
      punch.out(outPunch);
      const raw = punch.toRawRow(this.user.name);
      expect(raw).to.exist
    });
  });
  describe('#assignRow(row)', () => {
    beforeEach(() => {
      const start = moment({
        day: 3,
        hour: 7
      });
      const end = moment({
        day: 3,
        hour: 18
      });
      const timetable = new Timetable(start, end, moment.tz.zone('America/New_York'));
      timetable.setVacation(13, 0);
      timetable.setSick(5, 0);
      timetable.unpaidTotal = 0;
      timetable.loggedTotal = 0;
      timetable.averageLogged = 0;
      this.user = new User('Aaron Sky', 'aaronsky', true, timetable);
    });
    it('should not assign a row if no parameter is passed', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      punch.assignRow(null);
      expect(punch.row).to.not.exist;
    });
    it('should assign a row if a row is passed in', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      punch.assignRow(new Rows.RawDataRow({ save: () => {}, del: () => {} }));
      expect(punch.row).to.exist;
    });
  });
  describe('#isValid(user)', () => {
    beforeEach(() => {
      const start = moment({
        day: 3,
        hour: 7
      });
      const end = moment({
        day: 3,
        hour: 18
      });
      const timetable = new Timetable(start, end, moment.tz.zone('America/New_York'));
      timetable.setVacation(13, 0);
      timetable.setSick(5, 0);
      timetable.unpaidTotal = 0;
      timetable.loggedTotal = 0;
      timetable.averageLogged = 0;
      this.user = new User('Aaron Sky', 'aaronsky', true, timetable);
    });
    it('should return a failure reason for a repetitive in punch', () => {
      this.user.punches.push(Punch.parse(this.user, 'in', 'in'));
      const punch = Punch.parse(this.user, 'in', 'in');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for an in punch dated yesterday', () => {
      const punch = Punch.parse(this.user, 'in yesterday', 'in');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for an non-salary user punching unpaid time', () => {
      this.user.salary = false;
      const punch = Punch.parse(this.user, 'unpaid 9:50-10:00', 'unpaid');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for a vacation punch that exceeds available vacation time', () => {
      this.user.timetable.setVacation(5, 2);
      const punch = Punch.parse(this.user, 'vacation today', 'vacation');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for a sick punch that exceeds available sick time', () => {
      this.user.timetable.setSick(5, 2);
      const punch = Punch.parse(this.user, 'sick today', 'sick');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for a vacation/sick/unpaid punch that isn\'t divisible by 4', () => {
      let punch = Punch.parse(this.user, 'vacation 9:50-10:00', 'vacation');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
      punch = Punch.parse(this.user, 'sick 9:50-10:00', 'sick');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
      punch = Punch.parse(this.user, 'unpaid 9:50-10:00', 'unpaid');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return a failure reason for any punch dated older than 7 days', () => {
      const punch = Punch.parse(this.user, 'in Jul 6-8', 'in');
      expect(punch.isValid(this.user)).to.be.instanceof.String;
    });
    it('should return true for a valid punch', () => {
      const punch = Punch.parse(this.user, 'in', 'in');
      expect(punch.isValid(this.user)).to.be.true;
    });     
  });
  describe('#slackAttachment()', () => {

  });
  describe('#description(user, full)', () => {

  });
});
    