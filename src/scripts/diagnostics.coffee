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
    res.send "#{Organization.name}'s Ibizan has been up since
              #{Organization.initTime.toDate()}
              _(#{moment().preciseDiff(Organization.initTime)})_"
    Logger.addReaction 'dog2', res.message

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
    user = Organization.getUserBySlackName res.message.user.name
    if isAdminUser res.message.user.name
      response = ''
      for u in Organization.users
        response += u.description() + '\n\n'
      user.directMessage response, Logger
      Logger.addReaction 'dog2', res.message
    else
      user.directMessage strings.adminonly, Logger
      Logger.addReaction 'x', res.message

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

  robot.respond /projects/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    if isAdminUser res.message.user.name
      response = ''
      for project in Organization.projects
        response += project.description() + '\n\n'
      user.directMessage response, Logger
      Logger.addReaction 'dog2', res.message
    else
      user.directMessage strings.adminonly, Logger
      Logger.addReaction 'x', res.message

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

  robot.respond /calendar/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    if isAdminUser res.message.user.name
      user.directMessage Organization.calendar.description(), Logger
      Logger.addReaction 'dog2', res.message
    else
      user.directMessage strings.adminonly, Logger
      Logger.addReaction 'x', res.message
    
  robot.router.post '/ibizan/diagnostics/sync', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_SYNC_TOKEN
      response_url = body.response_url || null
      if response_url
        Logger.log "POSTing to #{response_url}"
      Organization.sync()
      .catch(
        (err) ->
          message = "Failed to resync"
          Logger.errorToSlack message, err
          payload =
            text: message
          if response_url
            robot.http(response_url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload))
          else
            res.status 200
            res.json {
              "text": message
            }
      )
      .done(
        (status) ->
          message = "Resynced with spreadsheet"
          Logger.log message
          payload =
            text: message
          if response_url
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
          else
            res.status 200
            res.json {
              "text": message
            }
      )
      res.status 200
      res.json {
        "text": "Beginning to resync..."
      }
    else
      res.status 401
      res.json {
        "text": strings.badtoken
      }

  robot.respond /sync/i, (res) ->
    Logger.addReaction 'clock4', res.message
    Organization.sync()
    .catch(
      (err) ->
        Logger.errorToSlack "Failed to resync", err
    )
    .done(
      (status) ->
        res.send "Resynced with spreadsheet"
        Logger.removeReaction 'clock4', res.message
        Logger.addReaction 'dog2', res.message
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
    Logger.addReaction 'dog2', res.message
