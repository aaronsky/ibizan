
expect = require('chai').expect

Logger = require '../../src/helpers/logger'

describe 'Logger', ->
  describe '#log', ->
    it 'should run without issue', ->
      Logger.log 'This is test output'
  describe '#warn', ->
    it 'should run without issue', ->
      Logger.warn 'This is test output'
  describe '#error', ->
    it 'should run without issue', ->
      Logger.error 'This is test output', null
      Logger.error 'This is test output', new Error('This is a test error')