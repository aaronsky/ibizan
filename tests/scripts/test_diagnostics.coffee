
Helper = require('hubot-test-helper')
expect = require('chai').expect
request = require('request')
querystring = require('querystring')

helper = new Helper('../../src/scripts/diagnostics.coffee')

process.env.ORG_NAME = "test"
process.env.SLASH_INFO_TOKEN = "abc123"
process.env.SLASH_USERS_TOKEN = "abc123"
process.env.SLASH_PROJECTS_TOKEN = "abc123"
process.env.SLASH_CALENDAR_TOKEN = "abc123"
process.env.SLASH_HOUND_TOKEN = "abc123"
process.env.SLASH_PAYROLL_TOKEN = "abc123"
process.env.SLASH_SYNC_TOKEN = "abc123"
process.env.SLASH_PUNCH_TOKEN = "abc123"
process.env.ADMINS = "admin"

goodtoken = querystring.stringify({ token: 'abc123' })
badtoken = querystring.stringify({ token: 'f' })
infoendpoint = 'http://localhost:8080/ibizan/diagnostics/info'

describe 'diagnostics', ->
  beforeEach ->
    @room = helper.createRoom()

  afterEach ->
    @room.destroy()

  context 'POST /ibizan/diagnostics/info', ->
    it 'responds with status 200 if correct token is provided', ->
      request.post infoendpoint, goodtoken, (err, response, body) ->
        if err
          console.log err
        expect(response.statusCode).to.equal 200
        return

    it 'responds with status 401 if incorrect token is provided', ->
      request.post infoendpoint, badtoken, (err, response, body) ->
        if err
          console.log err
        expect(response.statusCode).to.equal 401
        return

  context 'user says: hubot uptime', ->
    beforeEach ->
      @room.user.say 'briancoia', 'hubot uptime'

    it 'should reply with uptime', ->
      expect(@room.messages[0]).to.eql(['briancoia', 'hubot uptime'])
      expect(@room.messages[1][1]).to.include('has been up')
