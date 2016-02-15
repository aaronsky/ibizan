
moment = require 'moment'
expect = require('chai').expect

Organization = require('../src/models/organization').get()
Project = require '../src/models/project'
{ User, Timetable } = require '../src/models/user'
Punch = require '../src/models/punch'

Organization.projects = [
  new Project('#production'),
  new Project('#camp-fangamer')
]

describe 'Punch', ->
  describe '#parse(user, command, mode)', ->
    beforeEach ->
      start = moment().hour(7)
      end = moment().hour(18)
      timetable = new Timetable(start, end, 'Eastern')
      timetable.setVacation(13, 0)
      timetable.setSick(5, 0)
      timetable.setUnpaid(0)
      timetable.setOvertime(0)
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
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'out at a time without minutes yesterday', ->
      punch = Punch.parse @user, 'out 7pm yesterday', 'out'
      expect(punch).to.have.property 'mode', 'out'
      expect(punch).to.have.deep.property 'times[0]'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'in at a 24-hour time and an existing project', ->
      punch = Punch.parse @user, "in 17:00 ##{@projectName}", 'in'
      expect(punch).to.have.property 'mode', 'in'
      expect(punch).to.have.deep.property 'times[0]'
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
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
    it 'flag a date range as vacation', ->
      punch = Punch.parse @user, 'vacation 1/28 - 2/4', 'vacation'
      expect(punch).to.have.property 'mode', 'vacation'
      expect(punch).to.have.property 'times'
      expect(punch).to.have.property 'projects'
      expect(punch.projects).to.be.empty
      expect(punch).to.have.property 'notes'
      expect(punch.notes).to.be.empty
