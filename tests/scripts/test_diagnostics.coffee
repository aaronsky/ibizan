
Helper = require('hubot-test-helper')
expect = require('chai').expect
http = require('http')

# helper loads a specific script if it's a file
helper = new Helper('../../src/scripts/diagnostics.coffee')

describe 'diagnostics', ->
  room = null

  beforeEach ->
    room = helper.createRoom()

  afterEach ->
    room.destroy()

  context 'user says: hubot uptime', ->
    beforeEach ->
      room.user.say 'briancoia', 'hubot uptime'

    it 'should reply with uptime', ->
      expect(room.messages[0]).to.eql(['briancoia', 'hubot uptime'])
      expect(room.messages[1][1]).to.include('has been up')
