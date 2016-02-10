
expect = require('chai').expect

moment = require 'moment'
require '../lib/moment-holidays.js'

describe 'moment', ->

  describe '#holiday', ->
    it 'should return \"New Year\'s Day\" for \"2016-01-01\"', ->
      date = moment('2016-01-01')
      expect(date.holiday()).to.equal("New Year's Day")
    it 'should return \"RAAHB\" for \"2016-04-01\"', ->
      date = moment('2016-04-01')
      expect(date.holiday()).to.equal('RAAHB')
    it 'should return \"Independence Day\" for \"2016-07-04\"', ->
      date = moment('2016-07-04')
      expect(date.holiday()).to.equal('Independence Day')
    it 'should return \"Veteran\'s Day\" for \"2016-11-11\"', ->
      date = moment('2016-11-11')
      expect(date.holiday()).to.equal("Veteran's Day")
    it 'should return \"Christmas Eve\" for \"2016-12-24\"', ->
      date = moment('2016-12-24')
      expect(date.holiday()).to.equal('Christmas Eve')
    it 'should return \"Christmas Day\" for \"2016-12-25\"', ->
      date = moment('2016-12-25')
      expect(date.holiday()).to.equal('Christmas Day')
    it 'should return \"Martin Luther King Jr. Day\" for \"2016-01-18\"', ->
      date = moment('2016-01-18')
      expect(date.holiday()).to.equal('Martin Luther King Jr. Day')
    it 'should return \"Washington\'s Birthday\" for \"2016-02-15\"', ->
      date = moment('2016-02-15')
      expect(date.holiday()).to.equal("Washington's Birthday")
    it 'should return \"Memorial Day\" for \"2016-05-30\"', ->
      date = moment('2016-05-30')
      expect(date.holiday()).to.equal('Memorial Day')
    it 'should return \"Labor Day\" for \"2016-09-05\"', ->
      date = moment('2016-09-05')
      expect(date.holiday()).to.equal('Labor Day')
    it 'should return \"Thanksgiving Day\" for \"2016-11-24\"', ->
      date = moment('2016-11-24')
      expect(date.holiday()).to.equal('Thanksgiving Day')

  describe '#fromHolidayString', ->
    it 'should return \"2016-01-01\" for \"New Year\'s Day\"', ->
      date = moment().fromHolidayString("New Year's Day")
      expect(date.month()).to.equal(0)
      expect(date.date()).to.equal(1)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-04-01\" for \"RAAHB\"', ->
      date = moment().fromHolidayString('RAAHB')
      expect(date.month()).to.equal(3)
      expect(date.date()).to.equal(1)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-07-04\" for \"Independence Day\"', ->
      date = moment().fromHolidayString('Independence Day')
      expect(date.month()).to.equal(6)
      expect(date.date()).to.equal(4)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-11-11\" for \"Veteran\'s Day\"', ->
      date = moment().fromHolidayString("Veteran's Day")
      expect(date.month()).to.equal(10)
      expect(date.date()).to.equal(11)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-12-24\" for \"Christmas Eve\"', ->
      date = moment().fromHolidayString('Christmas Eve')
      expect(date.month()).to.equal(11)
      expect(date.date()).to.equal(24)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-12-25\" for \"Christmas Day\"', ->
      date = moment().fromHolidayString('Christmas Day')
      expect(date.month()).to.equal(11)
      expect(date.date()).to.equal(25)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-01-18\" for \"Martin Luther King Jr. Day\"', ->
      date = moment().fromHolidayString('Martin Luther King Jr. Day')
      expect(date.month()).to.equal(0)
      expect(date.date()).to.equal(18)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-02-15\" for \"Washington\'s Birthday\"', ->
      date = moment().fromHolidayString("Washington's Birthday")
      expect(date.month()).to.equal(1)
      expect(date.date()).to.equal(15)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-05-30\" for \"Memorial Day\"', ->
      date = moment().fromHolidayString('Memorial Day')
      expect(date.month()).to.equal(4)
      expect(date.date()).to.equal(30)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-09-05\" for \"Labor Day\"', ->
      date = moment().fromHolidayString('Labor Day')
      expect(date.month()).to.equal(8)
      expect(date.date()).to.equal(5)
      expect(date.year()).to.equal(2016)
    it 'should return \"2016-11-24\" for \"Thanksgiving Day\"', ->
      date = moment().fromHolidayString('Thanksgiving Day')
      expect(date.month()).to.equal(10)
      expect(date.date()).to.equal(24)
      expect(date.year()).to.equal(2016)