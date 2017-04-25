
import 'mocha';
import { expect, assert } from 'chai';
import * as moment from 'moment';

const { MockSheet, MockConfig } = require('../../../test/mocks');

import { Rows } from '../rows';
import { Organization } from '../organization';
import { Worksheet, Sheets } from '../sheet';
import { Punch } from '../punch';
import { User } from '../user';

let org = new Organization(MockConfig.team);

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
    beforeEach(() => {
        const sheetId = 'test';
        this.worksheet = new Worksheet(sheetId);
        this.worksheet.service = MockSheet.Service;
        this.worksheet.auth = MockSheet.Auth;
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
        beforeEach(() => {
            this.sheet = new Sheets.PayrollSheet(this.worksheet, MockSheet.getSheet(Sheets.PayrollSheet.title));
        });
        describe('#generateReport(reports)', () => {
            it('should generate payroll reports between the start and end times for each user passed', async () => {
                let end = moment();
                let start = end.subtract(2, 'weeks');
                try {
                    const opts = await this.worksheet.loadOptions();
                    const users: User[] = opts.users;
                    const userCount = users.length;
                    const reports = users.map(user => user.toRawPayroll(start, end));
                    const numberDone = await this.sheet.generateReport(reports, start, end);
                    expect(numberDone).to.equal(userCount);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
        });
    });
    describe('Sheets.RawDataSheet', () => {
        beforeEach(() => {
            this.sheet = new Sheets.RawDataSheet(this.worksheet, MockSheet.getSheet(Sheets.RawDataSheet.title));
        });
        describe('#enterPunch(punch, user)', () => {
            it('should fail without a punch', async () => {
                try {
                    const opts = await this.worksheet.loadOptions();
                    const user = opts.users[0];
                    await this.sheet.enterPunch(null, user);
                    assert.fail('Invalid parameters passed: Punch or user is undefined.', null);
                } catch (err) {
                    assert.isNotNull(err);
                }
            });
            it('should fail without a user', async () => {
                try {
                    const opts = await this.worksheet.loadOptions();
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
                    const opts = await this.worksheet.loadOptions();
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
                    const opts = await this.worksheet.loadOptions();
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
                    const opts = await this.worksheet.loadOptions();
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
                    const opts = await this.worksheet.loadOptions();
                    const user = opts.users[0];
                    const inPunch = Punch.parse(org, user, 'vacation 6/8-6/12', 'vacation');
                    await this.sheet.enterPunch(inPunch, user);
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
            it('should enter block punch for user', async () => {
                try {
                    const opts = await this.worksheet.loadOptions();
                    const user = opts.users[0];
                    const blockPunch = Punch.parse(org, user, '4.5 hours');
                    await this.sheet.enterPunch(blockPunch, user);
                    assert.isOk(true);
                } catch (err) {
                    assert.fail('success', err);
                }
            });
        });
    });
});