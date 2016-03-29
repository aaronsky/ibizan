
expect = require('chai').expect

# mockRobot = require '../mocks/mock_robot'

Logger = require '../../src/helpers/logger'
LoggerWithoutRobot = Logger()
LoggerWithBadRobot = Logger({})
LoggerWithRobot = Logger(mockRobot ? null)


describe 'Logger', ->
  describe '#log', ->
    it 'should run without issue', ->
      LoggerWithoutRobot.log 'This is test output'
  describe '#warn', ->
    it 'should run without issue', ->
      LoggerWithoutRobot.warn 'This is test output'
  describe '#error', ->
    it 'should run without issue', ->
      LoggerWithoutRobot.error 'This is test output', null
      LoggerWithoutRobot.error 'This is test output', new Error('This is a test error')
  describe '#fun', ->
    it 'should run without issue', ->
      LoggerWithoutRobot.fun 'This is test output :D'