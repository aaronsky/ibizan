expect = require('chai').expect

Project = require '../src/models/project'

describe 'Project', ->
  describe '#parse(row)', ->
    it 'should return if row is undefined'
    it 'should return a Project given a row'