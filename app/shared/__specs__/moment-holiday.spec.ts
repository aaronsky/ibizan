
import 'mocha';
const { expect } = require('chai');
import * as moment from 'moment';

import { holidayForMoment, momentForHoliday } from '../moment-holiday';

describe('holidayForMoment(date)', () => {
    function testMomentMatchesString(date: moment.Moment, holiday: string) {
        expect(holidayForMoment(date)).to.equal(holiday);
    }
    it('should return \"New Year\'s Day\" for \"2017-01-01\"', () => {
        testMomentMatchesString(moment('2017-01-01'), 'New Year\'s Day');
    });
    it('should return \"RAAHB\" for \"2017-04-01\"', () => {
        testMomentMatchesString(moment('2017-04-01'), 'RAAHB');
    });
    it('should return \"Independence Day\" for \"2017-07-04\"', () => {
        testMomentMatchesString(moment('2017-07-04'), 'Independence Day');
    });
    it('should return \"Veteran\'s Day\" for \"2017-11-11\"', () => {
        testMomentMatchesString(moment('2017-11-11'), 'Veteran\'s Day');
    });
    it('should return \"Christmas Eve\" for \"2017-12-24\"', () => {
        testMomentMatchesString(moment('2017-12-24'), 'Christmas Eve');
    });
    it('should return \"Christmas Day\" for \"2017-12-25\"', () => {
        testMomentMatchesString(moment('2017-12-25'), 'Christmas Day');
    });
    it('should return \"Martin Luther King Jr. Day\" for \"2017-01-18\"', () => {
        testMomentMatchesString(moment('2017-01-16'), 'Martin Luther King Jr. Day');
    });
    it('should return \"Washington\'s Birthday\" for \"2017-02-20\"', () => {
        testMomentMatchesString(moment('2017-02-20'), 'Washington\'s Birthday');
    });
    it('should return \"Memorial Day\" for \"2017-05-30\"', () => {
        testMomentMatchesString(moment('2017-05-29'), 'Memorial Day');
    });
    it('should return \"Labor Day\" for \"2017-09-05\"', () => {
        testMomentMatchesString(moment('2017-09-04'), 'Labor Day');
    });
    it('should return \"Thanksgiving Day\" for \"2017-11-24\"', () => {
        testMomentMatchesString(moment('2017-11-23'), 'Thanksgiving Day');
    });
});
describe('momentForHoliday(holiday)', () => {
    function testMomentMatchesString(holidayName: string, month: number, date: number, year: number) {
        const holiday = momentForHoliday(holidayName);
        expect(holiday.month()).to.equal(month);
        expect(holiday.date()).to.equal(date);
        expect(holiday.year()).to.equal(year);
    }
    it('should return \"2017-01-01\" for \"New Year\'s Day\"', () => {
        testMomentMatchesString('New Year\'s Day', 0, 1, 2017);
    });
    it('should return \"2017-04-01\" for \"RAAHB\"', () => {
        testMomentMatchesString('RAAHB', 3, 1, 2017);
    });
    it('should return \"2017-07-04\" for \"Independence Day\"', () => {
        testMomentMatchesString('Independence Day', 6, 4, 2017);
    });
    it('should return \"2017-11-11\" for \"Veteran\'s Day\"', () => {
        testMomentMatchesString('Veteran\'s Day', 10, 11, 2017);
    });
    it('should return \"2017-12-24\" for \"Christmas Eve\"', () => {
        testMomentMatchesString('Christmas Eve', 11, 24, 2017);
    });
    it('should return \"2017-12-25\" for \"Christmas Day\"', () => {
        testMomentMatchesString('Christmas Day', 11, 25, 2017);
    });
    it('should return \"2017-01-16\" for \"Martin Luther King Jr. Day\"', () => {
        testMomentMatchesString('Martin Luther King Jr. Day', 0, 16, 2017);
    });
    it('should return \"2017-02-13\" for \"Washington\'s Birthday\"', () => {
        testMomentMatchesString('Washington\'s Birthday', 1, 13, 2017);
    });
    it('should return \"2017-05-29\" for \"Memorial Day\"', () => {
        testMomentMatchesString('Memorial Day', 4, 29, 2017);
    });
    it('should return \"2017-09-04\" for \"Labor Day\"', () => {
        testMomentMatchesString('Labor Day', 8, 4, 2017);
    });
    it('should return \"2017-11-23\" for \"Thanksgiving Day\"', () => {
        testMomentMatchesString('Thanksgiving Day', 10, 23, 2017);
    });
    it('should return \"null\" for \"\"', () => {
        const date = momentForHoliday('');
        expect(date).to.be.null;
    });
});