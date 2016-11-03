
import 'mocha';
const { expect, assert } = require('chai');
import * as moment from 'moment';

const { MockSheet, MockConfig } = require('../../../test/mocks');

import { Rows } from '../../shared/rows';
import { Organization } from '../organization';
import { Spreadsheet } from '../sheet';
import { Punch } from '../punch';
import { User } from '../user';

let org = new Organization(MockConfig.team);

describe('Sheet', () => {
  beforeEach(() => {
    const sheetId = 'test';
    this.sheet = new Spreadsheet(sheetId);
    this.sheet.service = MockSheet.Service;
    this.sheet.auth = MockSheet.Auth;
  });
  describe('#authorize(clientId, clientSecret, redirectUri, token?)', () => {
    it('should authorize', async () => {
      try {
        await this.sheet.authorize('a client id', 'a client secret', 'https://nope.com', 'a token');
        assert.isOk(true);
      } catch (err) {
        assert.fail('success', err);
      }
    });
  });
  describe('#loadOptions()', () => {
    it('should load options successfully', async () => {
      try {
        await this.sheet.loadOptions();
        assert.isOk(true);
      } catch (err) {
        assert.fail('success', err);
      }
    });
  });
  describe('#saveRow(row, sheet)', () => {

  });
  describe('#newRow(row, sheet)', () => {

  });
  describe('#enterPunch(punch, user)', () => {
    it('should fail without a punch', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        await this.sheet.enterPunch(null, user);
        assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
      } catch (err) {
        assert.isNotNull(err);
      }
    });
    it('should fail without a user', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const inPunch = Punch.parse(org, user, 'in', 'in');
        await this.sheet.enterPunch(inPunch, null);
        assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
      } catch (err) {
        assert.isNotNull(err);
      }
    });
    it('should enter in punch for user', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const inPunch = Punch.parse(org, user, 'in', 'in');
        await this.sheet.enterPunch(inPunch, user);
        assert.isOk(true);
      } catch (err) {
        assert.fail('success', err);
      }
    });
    it('should attempt out punch for user, but fail due to lack of notes', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const outPunch = Punch.parse(org, user, 'out', 'out');
        let last;
        if (last = user.lastPunch('in')) {
          await this.sheet.enterPunch(outPunch, user);
        } else {
          const inPunch = Punch.parse(org, user, 'in', 'in');
          await this.sheet.enterPunch(inPunch, user);
          await this.sheet.enterPunch(outPunch, user);
        }
        assert.fail('success');
      } catch (err) {
        assert.isOk(true);
      }
    });
    it('should enter out punch for user', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const outPunch = Punch.parse(org, user, 'out did some things', 'out');
        let last;
        if (last = user.lastPunch('in')) {
          await this.sheet.enterPunch(outPunch, user);
        } else {
          const inPunch = Punch.parse(org, user, 'in', 'in');
          await this.sheet.enterPunch(inPunch, user);
          await this.sheet.enterPunch(outPunch, user);
        }
        assert.isOk(true);
      } catch (err) {
        assert.fail('success', err);
      }
    });
    it('should enter special punch for user', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const inPunch = Punch.parse(org, user, 'vacation 6/8-6/12', 'vacation');
        await this.sheet.enterPunch(inPunch, user);
        assert.isOk(true);
      } catch (err) {
        console.error(err);
        assert.fail('success', err);
      }
    });
    it('should enter block punch for user', async () => {
      try {
        const opts = await this.sheet.loadOptions();
        const user = opts.users[0];
        const blockPunch = Punch.parse(org, user, '4.5 hours');
        await this.sheet.enterPunch(blockPunch, user);
        assert.isOk(true);
      } catch (err) {
        assert.fail('success', err);
      }
    });
  });
  describe('#generateReport(reports)', () => {
    it('should generate payroll reports between the start and end times for each user passed', async () => {
      let end = moment();
      let start = end.subtract(2, 'weeks');
      try {
        const opts = await this.sheet.loadOptions();
        const users: User[] = opts.users;
        const userCount = users.length;
        const reports: Rows.PayrollReportsRow[] = [];
        for (let user of users) {
          const row = user.toRawPayroll(start, end);
          if (row) {
            reports.push(row);
          }
        }
        const numberDone = await this.sheet.generateReport(reports, start, end);
        expect(numberDone).to.equal(userCount);
      } catch (err) {
        console.log(err);
        assert.fail('success', err);
      }
    });
  });
  describe('#addEventRow(row)', () => {

  });
  describe('#loadWorksheets()', () => {

  });
  describe('#loadVariables(opts)', () => {

  });
  describe('#loadProjects(opts)', () => {

  });
  describe('#loadEmployees(opts)', () => {

  });
  describe('#loadEvents(opts)', () => {

  });
  describe('#loadPunches(opts)', () => {

  });
});