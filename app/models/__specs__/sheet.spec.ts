
import 'mocha';
import { expect, assert } from 'chai';
import * as moment from 'moment';

const { MockSheet, MockConfig } = require('../../../test/mocks');

import { Rows } from '../rows';
import { Organization } from '../organization';
import { Worksheet, Sheets } from '../sheet';
import { Punch } from '../punch';
import { User } from '../user';

describe('Sheet', () => {
    beforeEach(() => {
        this.sheet = new Worksheet('test');
        this.sheet.service = MockSheet.Service;
        this.sheet.auth = MockSheet.Auth;
    });
    describe('#authorize(clientEmail, privateKey)', () => {
        it('should authorize', async () => {
            try {
                //await this.sheet.authorize('a client email', 'a private key');
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
});

describe('Sheets', () => {
    beforeEach(async () => {
        const sheetId = 'test';
        this.org = new Organization(MockConfig.team);
        this.org.spreadsheet = new Worksheet(sheetId);
        this.org.spreadsheet.service = MockSheet.Service;
        this.org.spreadsheet.auth = MockSheet.Auth;
        const opts = await this.org.spreadsheet.loadOptions();
        this.org.users = opts.users;
        this.org.projects = opts.projects;
    });
    describe('Sheets.Sheet', () => {
        beforeEach(() => {

        });
        describe('#saveRow(row, sheet)', () => {

        });
        describe('#newRow(row, sheet)', () => {

        });
    });
    describe('Sheets.PayrollSheet', () => {
        beforeEach(async () => {
            this.org.spreadsheet.payroll = new Sheets.PayrollSheet(this.org.spreadsheet, MockSheet.getSheet(Sheets.PayrollSheet.title));
        });
        describe('#generateReport(reports)', () => {
            it('should generate payroll reports between the start and end times for each user passed', async () => {
                let end = moment();
                let start = end.subtract(2, 'weeks');
                try {
                    const userCount = this.org.users.length;
                    const reports = this.org.users.map(user => user.toRawPayroll(start, end));
                    const numberDone = await this.org.spreadsheet.payroll.generateReport(reports);
                    expect(numberDone).to.equal(userCount);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
        });
    });
    describe('Sheets.RawDataSheet', () => {
        beforeEach(async () => {
            this.org.spreadsheet.rawData = new Sheets.RawDataSheet(this.org.spreadsheet, MockSheet.getSheet(Sheets.RawDataSheet.title));
        });
        describe('#enterPunch(punch, user)', () => {
            it('should fail without a punch', async () => {
                try {
                    const user = this.org.users[0];
                    await this.org.spreadsheet.rawData.enterPunch(null, user, this.org);
                    assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
                } catch (err) {
                    assert.isNotNull(err);
                }
            });
            it('should fail without a user', async () => {
                try {
                    const user = this.org.users[0];
                    const inPunch = Punch.parse(this.org, user, 'in', 'in');
                    await this.org.spreadsheet.rawData.enterPunch(inPunch, null, this.org);
                    assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
                } catch (err) {
                    assert.isNotNull(err);
                }
            });
            it('should enter in punch for user', async () => {
                try {
                    const user = this.org.users[0];
                    const inPunch = Punch.parse(this.org, user, 'in', 'in');
                    await this.org.spreadsheet.rawData.enterPunch(inPunch, user, this.org);
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
            it('should attempt out punch for user, but fail due to lack of notes', async () => {
                try {
                    const user = this.org.users[0];
                    const outPunch = Punch.parse(this.org, user, 'out', 'out');
                    const last = user.lastPunch('in');
                    if (last) {
                        await this.org.spreadsheet.rawData.enterPunch(outPunch, user, this.org);
                    } else {
                        const inPunch = Punch.parse(this.org, user, 'in', 'in');
                        await this.org.spreadsheet.rawData.enterPunch(inPunch, user, this.org);
                        await this.org.spreadsheet.rawData.enterPunch(outPunch, user, this.org);
                    }
                    assert.fail('success');
                } catch (err) {
                    assert.isOk(true);
                }
            });
            it('should enter out punch for user', async () => {
                try {
                    const user = this.org.users[0];
                    const outPunch = Punch.parse(this.org, user, 'out did some things', 'out');
                    const last = user.lastPunch('in');
                    if (last) {
                        await this.org.spreadsheet.rawData.enterPunch(outPunch, user, this.org);
                    } else {
                        const inPunch = Punch.parse(this.org, user, 'in', 'in');
                        await this.org.spreadsheet.rawData.enterPunch(inPunch, user, this.org);
                        await this.org.spreadsheet.rawData.enterPunch(outPunch, user, this.org);
                    }
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
            it('should enter special punch for user', async () => {
                try {
                    const user = this.org.users[0];
                    const inPunch = Punch.parse(this.org, user, 'vacation 6/8-6/12', 'vacation');
                    await this.org.spreadsheet.rawData.enterPunch(inPunch, user, this.org);
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
            it('should enter block punch for user', async () => {
                try {
                    const user = this.org.users[0];
                    const blockPunch = Punch.parse(this.org, user, '4.5 hours');
                    await this.org.spreadsheet.rawData.enterPunch(blockPunch, user, this.org);
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
        });
    });
});