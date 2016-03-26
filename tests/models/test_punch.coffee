
moment = require 'moment'
expect = require('chai').expect

Organization = require('../../src/models/organization').get('test')
MockSheet = require '../mocks/mock_sheet.js'
Organization.spreadsheet.sheet = MockSheet
Project = require '../../src/models/project'
{ User, Timetable } = require '../../src/models/user'
Punch = require '../../src/models/punch'

Organization.projects = [
  new Project('#production'),
  new Project('#camp-fangamer')
]

describe 'Punch', ->
  describe '#parse(user, command, mode)', ->
    beforeEach ->
      start = moment({day: 3, hour: 7})
      end = moment({day: 3, hour: 18})
      timetable = new Timetable(start, end, moment.tz.zone('America/New_York'))
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setLogged(0)
      timetable.setAverageLogged(0)
      @user = new User('Aaron Sky', 'aaronsky', true, timetable)
      @projectName = 'production'
      @alternateProject = 'camp-fangamer'
    it 'should return if user and command are not defined', ->
      expect(Punch.parse(null, 'a dumb command')).to.be.undefined
      expect(Punch.parse(@user, null)).to.be.undefined
    it 'in without arguments', ->
      punch = Punch.parse @user, 'in', 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
    it 'out without arguments', ->
      punch = Punch.parse @user, 'out', 'out'
      expect(punch).to.have.property 'mode', 'out'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in with an existing project', ->
      punch = Punch.parse @user, "in ##{@projectName}", 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch).to.have.deep.property 'projects[0]'
      expect(punch).to.have.deep.property 'projects[0].name', @projectName
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'out with two existing projects', ->
      punch = Punch.parse @user,
                          "out ##{@projectName} ##{@alternateProject}",
                          'out'
      expect(punch).to.have.property 'mode', 'out'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch).to.have.deep.property 'projects[0]'
      expect(punch).to.have.deep.property 'projects[0].name',
                                          @projectName
      expect(punch).to.have.deep.property 'projects[1]'
      expect(punch).to.have.deep.property 'projects[1].name',
                                          @alternateProject
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in at a time without a period marker', ->
      punch = Punch.parse @user, 'in 9:15', 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      amPm = moment().format('A')
      expect(punch.times[0].format('hh:mm:ss A')).to.equal "09:15:00 #{amPm}"
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in at a time with a period marker and no space between', ->
      punch = Punch.parse @user, 'in 9:15pm', 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch.times[0].format('hh:mm:ss A')).to.equal "09:15:00 PM"
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in at a time with a period marker', ->
      punch = Punch.parse @user, 'in 9:15 pm', 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch.times[0].format('hh:mm:ss A')).to.equal "09:15:00 PM"
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'out at a time without minutes yesterday', ->
      punch = Punch.parse @user, 'out 7pm yesterday', 'out'
      expect(punch).to.have.property 'mode', 'out'
      expect(punch).to.have.deep.property 'times[0]'
      yesterday = moment().subtract(1, 'days')
      expect(punch.times[0].format('MM/DD/YYYY hh:mm:ss A'))
      .to.equal "#{yesterday.format('MM/DD/YYYY')} 07:00:00 PM"
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in at a 24-hour time and an existing project', ->
      punch = Punch.parse @user, "in 17:00 ##{@projectName}", 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch.times[0].format('hh:mm:ss A')).to.equal "05:00:00 PM"
      expect(punch).to.have.deep.property 'projects[0]'
      expect(punch).to.have.deep.property 'projects[0].name',
                                          @projectName
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'append time block to punch', ->
      punch = Punch.parse @user, '1.5 hours'
      expect(punch).to.have.property 'mode', 'none'
      expect(punch).to.have.deep.property 'times.block', 1.5
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'append time block to yesterday\'s punch', ->
      punch = Punch.parse @user, '2 hours yesterday'
      expect(punch).to.have.property 'mode', 'none'
      expect(punch).to.have.deep.property 'times.block', 2
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it "append time block to Tuesday\'s punch
         and assign it to an existing project", ->
      punch = Punch.parse @user, "3.25 hours tuesday ##{@projectName}"
      expect(punch).to.have.property 'mode', 'none'
      expect(punch).to.have.deep.property 'times.block', 3.25
      expect(punch).to.have.deep.property 'projects[0]'
      expect(punch).to.have.deep.property 'projects[0].name',
                                          @projectName
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag today as vacation', ->
      punch = Punch.parse @user, 'vacation today', 'vacation'
      expect(punch).to.have.property 'mode', 'vacation'
      expect(punch).to.have.property 'times'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag half of today as sick', ->
      punch = Punch.parse @user, 'sick half-day', 'sick'
      expect(punch).to.have.property 'mode', 'sick'
      expect(punch).to.have.property 'times'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag half of yesterday as vacation', ->
      punch = Punch.parse @user,
                          'vacation half-day yesterday',
                          'vacation'
      expect(punch).to.have.property 'mode', 'vacation'
      expect(punch).to.have.property 'times'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag a date range as sick', ->
      punch = Punch.parse @user, 'sick Jul 6-8', 'sick'
      expect(punch).to.have.property 'mode', 'sick'
      expect(punch).to.have.property 'times'
      expect(punch.elapsed).to.equal 33
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag a date range as vacation', ->
      punch = Punch.parse @user, 'vacation 1/28 - 2/4', 'vacation'
      expect(punch).to.have.property 'mode', 'vacation'
      expect(punch).to.have.property 'times'
      expect(punch.elapsed).to.equal 66
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
  describe '#out(punch)', ->
    beforeEach ->
      zone = 'America/New_York'
      start = moment.tz({hour: 7}, zone)
      end = moment.tz({hour: 18}, zone)
      timetable = new Timetable(start, end, zone)
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setLogged(0)
      timetable.setAverageLogged(0)
      @user = new User('Aaron Sky', 'aaronsky', true, timetable)
    it 'should modify the punch to an out punch', ->
      [start, end] = @user.activeHours()
      punch = Punch.parse @user,
        "in #{start.format('hh:mma')} #production", 'in'
      outPunch = Punch.parse @user,
        "out #{end.format('hh:mma')} #camp-fangamer", 'out'
      punch.out outPunch
      expect(punch.times).to.have.lengthOf 2
      expect(punch.times[0].format()).to.equal start.format()
      expect(punch.times[1].format()).to.equal end.format()
      expect(punch.projects).to.have.lengthOf 2
      expect(punch).to.have.deep.property 'projects[0].name',
                                          'production'
      expect(punch).to.have.deep.property 'projects[1].name',
                                          'camp-fangamer'
  describe '#toRawRow(name)', ->
    beforeEach ->
      start = moment({day: 3, hour: 7})
      end = moment({day: 3, hour: 18})
      timetable = new Timetable(start, end, moment.tz.zone('America/New_York'))
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setLogged(0)
      timetable.setAverageLogged(0)
      name = 'Aaron Sky'
      @user = new User(name, 'aaronsky', true, timetable)
    it 'should return a raw object for use with Sheet', ->
      punch = Punch.parse @user, 'in', 'in'
      raw = punch.toRawRow @user.name
      expect(raw).to.exist
    it 'should return a raw object for an in punch', ->
      punch = Punch.parse @user, 'in', 'in'
      raw = punch.toRawRow @user.name
      expect(raw).to.exist
    it 'should return a raw object for an out punch', ->
      punch = Punch.parse @user, 'in 9:00am', 'in'
      outPunch = Punch.parse @user, 'out 10:30am', 'out'
      punch.out outPunch
      raw = punch.toRawRow @user.name
      expect(raw).to.exist
  describe '#assignRow', ->
    beforeEach ->
      start = moment({day: 3, hour: 7})
      end = moment({day: 3, hour: 18})
      timetable = new Timetable(start, end, moment.tz.zone('America/New_York'))
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setLogged(0)
      timetable.setAverageLogged(0)
      @user = new User('Aaron Sky', 'aaronsky', true, timetable)
    it 'should not assign a row if no parameter is passed', ->
      punch = Punch.parse @user, 'in', 'in'
      punch.assignRow()
      expect(punch.row).to.not.exist
    it 'should not assign a row if an invalid row is passed', ->
      punch = Punch.parse @user, 'in', 'in'
      punch.assignRow({})
      expect(punch.row).to.not.exist
    it 'should assign a row if a row is passed in', ->
      punch = Punch.parse @user, 'in', 'in'
      punch.assignRow({
        save: () -> ,
        del: () ->
      })
      expect(punch.row).to.exist
  describe '#isValid(user)', ->
    beforeEach ->
      start = moment({day: 3, hour: 7})
      end = moment({day: 3, hour: 18})
      timetable = new Timetable(start, end, moment.tz.zone('America/New_York'))
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setLogged(0)
      timetable.setAverageLogged(0)
      @user = new User('Aaron Sky', 'aaronsky', true, timetable)
    it 'should return a failure reason for a repetitive in punch', ->
      @user.punches.push(Punch.parse(@user, 'in', 'in'))
      punch = Punch.parse @user, 'in', 'in'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for an in punch dated yesterday', ->
      punch = Punch.parse @user, 'in yesterday', 'in'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for an non-salary user punching unpaid time', ->
      @user.salary = false
      punch = Punch.parse @user, 'unpaid 9:50-10:00', 'unpaid'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for a vacation punch that exceeds available vacation time', ->
      @user.timetable.setVacation(5, 2)
      punch = Punch.parse @user, 'vacation today', 'vacation'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for a sick punch that exceeds available sick time', ->
      @user.timetable.setSick(5, 2)
      punch = Punch.parse @user, 'sick today', 'sick'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for a vacation/sick/unpaid punch that isn\'t divisible by 4', ->
      punch = Punch.parse @user, 'vacation 9:50-10:00', 'vacation'
      expect(punch.isValid(@user)).to.be.instanceof.String
      punch = Punch.parse @user, 'sick 9:50-10:00', 'sick'
      expect(punch.isValid(@user)).to.be.instanceof.String
      punch = Punch.parse @user, 'unpaid 9:50-10:00', 'unpaid'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return a failure reason for any punch dated older than 7 days', ->
      punch = Punch.parse @user, 'in Jul 6-8', 'in'
      expect(punch.isValid(@user)).to.be.instanceof.String
    it 'should return true for a valid punch', ->
      punch = Punch.parse @user, 'in', 'in'
      expect(punch.isValid(@user)).to.be.true
