
import 'mocha';
import * as moment from 'moment';
const { expect, assert } = require('chai');
const { MockSheet } = require('../../../test/mocks');

import { Organization } from '../organization';

describe('Organization', () => {
  beforeEach(async () =>  {
    this.organization = Organization.get();
    if (!this.organization.spreadsheet.sheet) {
      this.organization.spreadsheet.sheet = MockSheet;
    }
    await this.organization.sync({
      client_email: 'bad@email.com',
      private_key: 'bad key'
    });
  });
  describe('#constructor(config?)', () => {

  });
  describe('#ready()', () => {

  });
  describe('#sync(auth?)', () => {
    it('should sync all options appropriately', () => {
      expect(this.organization).to.have.deep.property('users');
      expect(this.organization).to.have.deep.property('projects');
      expect(this.organization).to.have.deep.property('calendar');
      expect(this.organization).to.have.deep.property('clockChannel');
      expect(this.organization).to.have.deep.property('exemptChannels');
    });
  });
  describe('#getUserBySlackName(name, users?)', () => {
    it('should return a User when provided a Slack username', () => {
      const user = this.organization.getUserBySlackName('aaronsky');
      expect(user).to.exist;
      expect(user).to.have.deep.property('slack', 'aaronsky');
    });
  });
  describe('#getUserByRealName(name, users?)', () => {
    it('should return a User when provided a real name', () => {
      const user = this.organization.getUserByRealName('Aaron Sky');
      expect(user).to.exist;
      expect(user).to.have.deep.property('name', 'Aaron Sky');
    });
  });
  describe('#getProjectByName(name, projects?)', () => {
    it('should return a Project when provided a project name', () => {
      const project = this.organization.getProjectByName('production');
      expect(project).to.exist;
      expect(project).to.have.deep.property('name', 'production');
    });
  });
  describe('#addEvent(date, name)', () => {

  });
  describe('#generateReport(start, end, send)', () => {
    it('should generate payroll reports between the start and end times for each of the users passed', async () => {
      const userCount = this.organization.users.length;
      const end = moment();
      const start = end.subtract(2, 'weeks');
      try {
        const reports = await this.organization.generateReport(start, end);
        const numberDone = reports.length;
        expect(numberDone).to.equal(userCount);
      } catch(err) {
        assert.fail('success', err);
      }
    });
  });
  describe('#dailyReport(reports, today, yesterday)', () => {

  });
  describe('#resetHounding()', () => {
    it('should reset hounding for all loaded users', () => {
      const userCount = this.organization.users.length;
      const resetCount = this.organization.resetHounding();
      expect(resetCount).to.equal(userCount);
    });
  });
  describe('#setHoundFrequency(frequency)', () => {

  });
  describe('#setShouldHound(should)', () => {

  });
});