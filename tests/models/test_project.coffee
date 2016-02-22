expect = require('chai').expect

Project = require '../../src/models/project'

test_row =
  project: '#production'
  weekstarting: '1/1/2014'
  totalofhours: '100'

bad_row =
  project: '#production'
  weekstarting: '1/1/2014'
  totalofhours: 'jeff'

describe 'Project', ->
  describe '#parse(row)', ->
    it 'should return undefined when a row is not provided', ->
      project = Project.parse()
      expect(project).to.be.undefined
    it 'should return a project when passed a row', ->
      project = Project.parse(test_row)
      expect(project).to.have.property 'name', 'production'
      expect(project).to.have.property 'start'
      expect(project).to.have.property 'total', 100
    it 'should handle bad data gracefully', ->
      project = Project.parse(bad_row)
      expect(project).to.have.property 'name', 'production'
      expect(project).to.have.property 'start'
      expect(project).to.have.property 'total', 0
