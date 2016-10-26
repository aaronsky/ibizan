
import moment from 'moment';

import Spreadsheet from '../sheet';
import Punch from '../punch';

describe('Sheet', () => {
  beforeEach(() => {
    const sheetId = 'bad id';
    this.sheet = new Spreadsheet(sheetId);
    this.sheet.sheet = MockSheet;
  });
  describe('#authorize(auth)', () => {
    it('should authorize', async () => {
      try {
        await this.sheet.authorize({
          client_email: 'bad@email.com',
          private_key: 'bad key'
        });
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
  describe('#saveRow(row, rowName)', () => {

  });
  describe('#newRow(sheet, row, rowName)', () => {

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
        const inPunch = Punch.parse(user, 'in', 'in');
        await this.sheet.enterPunch(inPunch, null);
        assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
      } catch (err) {
        assert.isNotNull(err);
      }
    });
    it('should enter in punch for user', async () => {
      try {
        const opts = this.sheet.loadOptions();
        const user = opts.users[0];
        const inPunch = Punch.parse(user, 'in', 'in');
        await this.sheet.enterPunch(inPunch, user);
        assert.isOk(true);
      } catch (err) {
        console.log(err);
        assert.fail('success', err);
      }
    });
    it('should attempt out punch for user, but fail due to lack of notes', async () => {
      try {
        const opts = this.sheet.loadOptions();
        const user = opts.users[0];
        const outPunch = Punch.parse(user, 'out', 'out');
        let last;
        if (last = user.lastPunch('in')) {
          await this.sheet.enterPunch(outPunch, user);
        } else {
          const inPunch = Punch.parse(user, 'in', 'in');
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
        const opts = this.sheet.loadOptions;
        const user = opts.users[0];
        const outPunch = Punch.parse(user, 'out did some things', 'out');
        let last;
        if (last = user.lastPunch('in')) {
          await this.sheet.enterPunch(outPunch, user);
        } else {
          const inPunch = Punch.parse(user, 'in', 'in');
          await this.sheet.enterPunch(inPunch, user);
          await this.sheet.enterPunch(outPunch, user);
        }
        assert.isOk(true);
      } catch (err) {
        console.log(err);
        assert.fail('success', err);
      }
    });
    it('should enter special punch for user', async () => {
      try {
        const opts = this.sheet.loadOptions;
        const user = opts.users[0];
        const inPunch = Punch.parse(user, 'vacation 6/8-6/12', 'vacation');
        await this.sheet.enterPunch(inPunch, user);
        assert.isOk(true);
      } catch (err) {
        console.log(err);
        assert.fail('success', err);
      }
    });
    it('should enter block punch for user', async () => {
      try {
        const opts = this.sheet.loadOptions;
        const user = opts.users[0];
        const blockPunch = Punch.parse(user, '4.5 hours');
        await this.sheet.enterPunch(blockPunch, user);
        assert.isOk(true);
      } catch (err) {
        console.log(err);
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
        const userCount = opts.users.length;
        const numberDone = await this.sheet.generateReport(opts.users, start, end);
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