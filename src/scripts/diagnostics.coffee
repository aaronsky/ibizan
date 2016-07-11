# Description:
#   Your dog friend makes sure everything's in order
#
# Commands:
#
# Notes:
#
# Author:
#   aaronsky

moment = require 'moment'
require 'moment-precise-range-plugin'

{ HEADERS, STRINGS } = require '../helpers/constants'
strings = STRINGS.diagnostics

Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user in process.env.ADMINS.split(" ")

  # Org statistics
  robot.router.post '/ibizan/diagnostics/info', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_INFO_TOKEN
      res.status 200
      response = {
        "text": "#{Organization.name}'s Ibizan has been up since
                 #{Organization.initTime.toDate()}
                 (#{moment().preciseDiff(Organization.initTime)})",
        "response_type": "in_channel"
      }
    else
      res.status 401
      response =  {
        "text": strings.badtoken
      }
    res.json response

  robot.respond /uptime/i, (res) ->
    Logger.logToChannel "#{Organization.name}'s Ibizan has been up since
                         #{Organization.initTime.toDate()}
                         _(#{moment().preciseDiff(Organization.initTime)})_",
                         res.message.rawMessage.channel
    Logger.reactToMessage 'dog2',
                          res.message.user.name,
                          res.message.rawMessage.channel,
                          res.message.id

  robot.router.post '/ibizan/diagnostics/users', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_USERS_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = strings.adminonly
      else
        res.status 200
        response = ''
        for user in Organization.users
          response += user.description() + '\n\n'
    else
      res.status 401
      response = strings.badtoken
    res.json {
      "text": response
    }

  robot.respond /users/i, (res) ->
    if isAdminUser res.message.user.name
      response = ''
      for user in Organization.users
        response += user.description() + '\n\n'
      user.directMessage response, Logger
      Logger.reactToMessage 'dog2',
                            res.message.user.name,
                            res.message.rawMessage.channel,
                            res.message.id
    else
      user.directMessage strings.adminonly, Logger
      Logger.reactToMessage 'x',
                            res.message.user.name,
                            res.message.rawMessage.channel,
                            res.message.id

  robot.router.post '/ibizan/diagnostics/projects', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_PROJECTS_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = strings.adminonly
      else
        res.status 200
        response = ''
        for project in Organization.projects
          response += project.description() + '\n\n'
    else
      res.status 401
      response = strings.badtoken
    res.json {
      "text": response
    }
    
  robot.router.post '/ibizan/diagnostics/calendar', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_CALENDAR_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = string.adminonly
      else
        res.status 200
        response = Organization.calendar.description()
    else
      res.status 401
      response = strings.badtoken
    res.json {
      "text": response
    }
    
  robot.router.post '/ibizan/diagnostics/sync', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_SYNC_TOKEN
      response_url = body.response_url
      if response_url
        Logger.log "POSTing to #{response_url}"
        Organization.sync()
        .catch(
          (err) ->
            Logger.errorToSlack "Failed to resync", err
            payload =
              text: 'Failed to resync'
            robot.http(response_url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload))
        )
        .done(
          (status) ->
            Logger.log "Options have been reloaded"
            payload =
              text: 'Resynced with spreadsheet'
            robot.http(response_url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload)) (err, response, body) ->
              if err
                response.send "Encountered an error :( #{err}"
                return
              if res.statusCode isnt 200
                response.send "Request didn't come back HTTP 200 :("
                return
              Logger.log body
        )
        res.status 200
        res.json {
          "text": "Beginning to resync..."
        }
      else
        res.status 500
        res.json {
          "text": "No return url provided by Slack"
        }
    else
      res.status 401
      res.json {
        "text": strings.badtoken
      }

  robot.respond /sync/i, (res) ->
    Logger.reactToMessage 'clock4',
                          res.message.user.name,
                          res.message.rawMessage.channel,
                          res.message.id
    Organization.sync()
    .catch(
      (err) ->
        Logger.errorToSlack "Failed to resync", err
    )
    .done(
      (status) ->
        Logger.logToChannel "Resynced with spreadsheet",
                            res.message.user.name
        Logger.reactToMessage 'clock4',
                              res.message.user.name,
                              res.message.rawMessage.channel,
                              res.message.id,
                              'reactions.remove'
        Logger.reactToMessage 'dog2',
                              res.message.user.name,
                              res.message.rawMessage.channel,
                              res.message.id
    )


  robot.router.post '/ibizan/diagnostics/help', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_HELP_TOKEN
      res.status 200
      response = strings.help
    else
      res.status 401
      response = strings.badtoken
    res.json {
      "text": response
    }

  robot.respond /help/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    user.directMessage strings.help, Logger
    Logger.reactToMessage 'dog2',
                          res.message.user.name,
                          res.message.rawMessage.channel,
                          res.message.id
