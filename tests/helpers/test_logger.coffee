
expect = require('chai').expect

mockRobot = require '../mocks/mock_robot'

Logger = require '../../src/helpers/logger'
LoggerWithoutRobot = Logger()
LoggerWithBadRobot = Logger({})
LoggerWithRobot = Logger(mockRobot)

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
      LoggerWithoutRobot.error 'This is test output',
                               new Error('This is a test error')
  describe '#fun', ->
    it 'should run without issue', ->
      LoggerWithoutRobot.fun 'This is test output :D'
  describe '#logToChannel', ->
    it 'should log without a robot', ->
      LoggerWithoutRobot.logToChannel 'This is test output'
    it 'should log to the console with a bad robot', ->
      LoggerWithBadRobot.logToChannel 'This is test output'
    it 'should log with a robot', ->
      LoggerWithRobot.logToChannel 'This is test output'
  describe '#errorToSlack', ->
    beforeEach ->
      @msg = 'This is test output'
      @err = new Error ('I\'m an error')
    it 'should log an error without a robot', ->
      LoggerWithoutRobot.errorToSlack @msg, null
      LoggerWithoutRobot.errorToSlack @msg, @err
    it 'should log an error to the console with a bad robot', ->
      LoggerWithBadRobot.errorToSlack @msg, null
      LoggerWithBadRobot.errorToSlack @msg, @err
    it 'should log an error with a robot', ->
      LoggerWithRobot.errorToSlack @msg, null
      LoggerWithRobot.errorToSlack @msg, @err
  describe '#reactToMessage', ->
    beforeEach ->
      @reaction = 'dog2'
      @user = 'aaronsky'
      @channel = 'ibizan-diagnostics'
      @slackTs = 10
    it 'should log to the console without a robot', ->
      LoggerWithoutRobot.reactToMessage @reaction, @user, @channel, @slackTs
    it 'should log to the console to the console with a bad robot', ->
      LoggerWithBadRobot.reactToMessage @reaction, @user, @channel, @slackTs
    it 'should react to the message with a robot', ->
      LoggerWithRobot.reactToMessage @reaction, @user, @channel, @slackTs