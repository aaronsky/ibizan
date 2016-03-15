
moment = require 'moment'
chai = require 'chai'
expect = chai.expect
assert = chai.assert

Organization = require '../../src/models/organization'
MockSheet = require '../mocks/mock_sheet.js'

describe 'Organization', ->
  beforeEach ->
    @organization = Organization.get('test')
    if not @organization.spreadsheet.sheet
      @organization.spreadsheet.sheet = MockSheet
    return @organization.sync({
        client_email: 'bad@email.com',
        private_key: 'bad key'
      })
  describe '> Calendar', ->
    describe '#description()', ->
      it 'should return a description of the project for output', ->
        description = @organization.calendar.description()
        expect(description).to.exist
  describe '#constructor(name)', ->
  describe '#sync()', ->
    it 'should sync all options appropriately', ->
      expect(@organization).to.have.deep.property 'users'
      expect(@organization).to.have.deep.property 'projects'
      expect(@organization).to.have.deep.property 'calendar'
      expect(@organization).to.have.deep.property 'clockChannel'
      expect(@organization).to.have.deep.property 'exemptChannels'
  describe '#getUserBySlackName(name, users)', ->
    it 'should return a User when provided a Slack username', ->
      user = @organization.getUserBySlackName 'aaronsky'
      expect(user).to.exist
      expect(user).to.have.deep.property 'slack', 'aaronsky'
  describe '#getUserByRealName(name, users)', ->
    it 'should return a User when provided a real name', ->
      user = @organization.getUserByRealName 'Aaron Sky'
      expect(user).to.exist
      expect(user).to.have.deep.property 'name', 'Aaron Sky'
  describe '#getProjectByName(name, projects)', ->
    it 'should return a Project when provided a project name', ->
      project = @organization.getProjectByName 'production'
      expect(project).to.exist
      expect(project).to.have.deep.property 'name', 'production'
  describe '#generateReport(start, end)', ->
    it "should generate payroll reports between the start and
        end times for each of the users passed", ->
      userCount = @organization.users.length
      end = moment()
      start = end.subtract(2, 'weeks')
      return @organization.generateReport(start, end)
              .then((numberDone) ->
                expect(numberDone).to.be.equal userCount
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#resetHounding()', ->
    it 'should reset hounding for all loaded users', ->
      userCount = @organization.users.length
      resetCount = @organization.resetHounding()
      expect(resetCount).to.equal userCount
