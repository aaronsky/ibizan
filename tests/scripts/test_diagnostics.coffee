
Helper = require('hubot-test-helper')
expect = require('chai').expect
http = require('http')
querystring = require('querystring')

helper = new Helper('../../src/scripts/diagnostics.coffee')

process.env.ORG_NAME = "test"
process.env.ADMINS = "admin"

goodtoken = querystring.stringify({ token: 'abc123' })
badtoken = querystring.stringify({ token: 'f' })

describe 'diagnostics', ->
  beforeEach ->
    @room = helper.createRoom()

  afterEach ->
    @room.destroy()

  context 'user says: hubot uptime', ->
    beforeEach ->
      @room.user.say 'aaronsky', 'hubot uptime'

    it 'should reply with uptime', ->
      expect(@room.messages[0]).to.eql(['aaronsky', 'hubot uptime'])
      expect(@room.messages[1][1]).to.include('has been up')

  # context 'user says: hubot users', ->
  #   beforeEach ->
  #     @room.user.say 'aaronsky', 'hubot users'

  #   it 'should shun the non-admin', ->
  #     expect(@room.messages[0]).to.eql(['aaronsky', 'hubot users'])
  #     expect(@room.messages[1][1]).to.include('must be an admin')

  # context 'admin says: hubot users', ->
  #   beforeEach ->
  #     @room.user.say 'admin', 'hubot users'

  #   it 'should reply with a list of users', ->
  #     expect(@room.messages[0]).to.eql(['admin', 'hubot users'])
  #     expect(@room.messages[1][1]).to.include('users')
