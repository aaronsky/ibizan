
moment = require 'moment'
chai = require 'chai'
assert = chai.assert
expect = chai.expect

Spreadsheet = require '../../src/models/sheet'
MockSheet = require '../mocks/mock_sheet.js'
Punch = require '../../src/models/punch'

describe 'Sheet', ->
  beforeEach ->
    sheet_id = 'bad id'
    @sheet = new Spreadsheet(sheet_id)
    @sheet.sheet = MockSheet
  describe '#constructor', ->
  describe '#authorize(auth)', ->
    it 'should authorize', ->
      return @sheet.authorize({
                client_email: 'bad@email.com',
                private_key: 'bad key'
              })
              .then(() -> assert.isOk(true))
              .catch((err) -> assert.fail('success', err))
  describe '#loadOptions()', ->
    it 'should load options successfully', ->
      return @sheet.loadOptions()
              .then(() -> assert.isOk(true))
              .catch((err) -> assert.fail('success', err))
  describe '#enterPunch(punch, user)', ->
    it 'should fail without a punch', ->
      that = @
      return @sheet.loadOptions()
              .then((opts) ->
                user = opts.users[0]
                return that.sheet.enterPunch null, user
              )
              .then(() ->
                assert.fail 'Invalid parameters passed: Punch or user is undefined.', null
              )
              .catch((err) ->
                assert.isNotNull err
              )
    it 'should fail without a user', ->
      that = @
      return @sheet.loadOptions()
              .then((opts) ->
                inPunch = Punch.parse user, 'in', 'in'
                return that.sheet.enterPunch inPunch, null
              )
              .then(() ->
                assert.fail 'Invalid parameters passed: Punch or user is undefined.', null
              )
              .catch((err) ->
                assert.isNotNull err
              )
    it 'should enter in punch for user', ->
      that = @
      return @sheet.loadOptions()
              .then((opts) ->
                user = opts.users[0]
                inPunch = Punch.parse user, 'in', 'in'
                return that.sheet.enterPunch inPunch, user
              )
              .then(() ->
                assert.isOk true
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
    it 'should enter out punch for user', ->
      that = @
      user = null
      return @sheet.loadOptions()
              .then((opts) ->
                user = opts.users[0]
                if last = user.lastPunch 'in'
                  outPunch = Punch.parse user, 'out', 'out'
                  promise = that.sheet.enterPunch outPunch, user
                if promise
                  return promise
                else
                  inPunch = Punch.parse user, 'in', 'in'
                  return that.sheet.enterPunch(inPunch, user)
                          .then(that.sheet.enterPunch(outPunch, user).bind(that))
              )
              .then(() ->
                assert.isOk true
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
    it 'should enter special punch for user', ->
      that = @
      return @sheet.loadOptions()
              .then((opts) ->
                user = opts.users[0]
                inPunch = Punch.parse user, 'vacation 6/8-6/12', 'vacation'
                return that.sheet.enterPunch inPunch, user
              )
              .then(() ->
                assert.isOk true
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
    it 'should enter block punch for user', ->
      that = @
      return @sheet.loadOptions()
              .then((opts) ->
                user = opts.users[0]
                blockPunch = Punch.parse user, '4.5 hours'
                return that.sheet.enterPunch blockPunch, user
              )
              .then(() ->
                assert.isOk true
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#generateReport()', ->
    it "should generate payroll reports between the start and
        end times for each of the users passed", ->
      that = @
      userCount = 0
      end = moment()
      start = end.subtract(2, 'weeks')
      return @sheet.loadOptions()
              .then((opts) ->
                userCount = opts.users.length
                return that.sheet.generateReport(opts.users, start, end)
              )
              .then((numberDone) ->
                expect(numberDone).to.be.equal userCount
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#_loadWorksheets()', ->
    it 'should load worksheets as properties', ->
      that = @
      return @sheet._loadWorksheets()
              .then(() ->
                expect(that.sheet).to.have.deep.property 'rawData'
                expect(that.sheet).to.have.deep.property 'payroll'
                expect(that.sheet).to.have.deep.property 'variables'
                expect(that.sheet).to.have.deep.property 'projects'
                expect(that.sheet).to.have.deep.property 'employees'
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#_loadVariables(opts)', ->
    it 'should load variables successfully', ->
      return @sheet._loadWorksheets()
              .then(@sheet._loadVariables.bind(@sheet))
              .then((opts) ->
                expect(opts).to.have.deep.property 'vacation', 104
                expect(opts).to.have.deep.property 'sick', 40
                expect(opts).to.have.deep.property 'holidays'
                expect(opts).to.have.deep.property 'clockChannel', 'timeclock'
                expect(opts).to.have.deep.property 'exemptChannels'
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#_loadProjects(opts)', ->
    it 'should load variables successfully', ->
      return @sheet._loadWorksheets()
              .then(@sheet._loadProjects.bind(@sheet))
              .then((opts) ->
                expect(opts).to.have.deep.property 'projects'
                expect(opts).to.have.deep.property 'projects[0]'
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#_loadEmployees(opts)', ->
    it 'should load variables successfully', ->
      return @sheet._loadWorksheets()
              .then(@sheet._loadEmployees.bind(@sheet))
              .then((opts) ->
                expect(opts).to.have.deep.property 'users'
                expect(opts).to.have.deep.property 'users[0]'
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )
  describe '#_loadPunches(opts)', ->
    it 'should load variables successfully', ->
      return @sheet._loadWorksheets()
              .then(@sheet._loadEmployees.bind(@sheet))
              .then(@sheet._loadPunches.bind(@sheet))
              .then((opts) ->
                expect(opts).to.have.deep.property 'users'
                expect(opts).to.have.deep.property 'users[0]'
                expect(opts).to.have.deep.property 'users[0].punches'
                expect(opts).to.have.deep.property 'users[0].punches[0]'
              )
              .catch((err) ->
                console.log err
                assert.fail('success', err)
              )


