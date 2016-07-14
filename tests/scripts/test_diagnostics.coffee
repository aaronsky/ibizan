
Helper = require('hubot-test-helper')
expect = require('chai').expect
http = require('http')
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

describe 'diagnostics', ->
  beforeEach ->
    @room = helper.createRoom()

  afterEach ->
    @room.destroy()

  context 'user says: hubot uptime', ->
    beforeEach ->
      @room.user.say 'briancoia', 'hubot uptime'

    it 'should reply with uptime', ->
      expect(@room.messages[0]).to.eql(['briancoia', 'hubot uptime'])
      expect(@room.messages[1][1]).to.include('has been up')

  # context 'POST /ibizan/diagnostics/info', ->
  #   beforeEach ->
  #     @goodoptions =
  #       hostname: 'localhost',
  #       port: 8080,
  #       path: '/ibizan/diagnostics/info?' + goodtoken,
  #       method: 'POST'
  #     @badoptions =
  #       hostname: 'localhost',
  #       port: 8080,
  #       path: '/ibizan/diagnostics/info?' + badtoken,
  #       method: 'POST'

  #   it 'responds with status 200 if correct token is provided', ->
  #     req = http.request @goodoptions, (response) ->
  #       @response = response
  #     req.end()
  #     expect(@response.statusCode).to.equal 200

  #   it 'responds with status 401 if incorrect token is provided', ->
  #     req = http.request @badoptions, (response) ->
  #       @response = response
  #     req.end()
  #     expect(@response.statusCode).to.equal 401
