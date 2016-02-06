
expect = require('chai').expect

Spreadsheet = require '../src/models/sheet.coffee'

describe 'Sheet', ->
  describe '#constructor', ->
    beforeEach ->
      sheet_id = ''
      @sheet = new Spreadsheet(sheet_id)
    it 'should set the sheet id'
    it 'should not be fully initialized'
  describe '#authorize(auth, cb)', ->
    it 'should callback on success'
    it 'should callback with an error if no keys are passed'
    it 'should callback with an error if it fails to authenticate'
  describe '#loadOptions(cb)', ->
    it 'should callback with an options object on success'
    it 'should callback with an error if @sheet#getInfo returns an error'
    it 'should callback with an error if the worksheets are undefined or null'
    it 'should callback with an error if there are less than five worksheets'
    it 'should callback with an error if the worksheets are not named correctly'
  describe '#loadVariables(worksheet, cb)', ->
    it 'should accept a worksheet with the properties in the variables header'
    it 'should callback with an options object on success'
    it 'should callback with an error if it fails to populate a required field'
    it 'should callback with a warning if it fails to populate an optional field'
  describe '#loadProjects(worksheet, cb)', ->
    it 'should accept a worksheet with the properties in the projects header'
    it 'should callback with an options object on success'
    it 'should callback with an error if it fails to populate a required field'
    it 'should callback with a warning if it fails to populate an optional field'
  describe '#loadEmployees(worksheet, cb)', ->
    it 'should accept a worksheet with the properties in the employees header'
    it 'should callback with an options object on success'
    it 'should callback with an error if it fails to populate a required field'
    it 'should callback with a warning if it fails to populate an optional field'
  describe '#enterPunch(punch)', ->
  describe '#generateReport()', ->

