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

constants = require '../helpers/constants'
HEADERS = constants.HEADERS
# TODO: FIX THIS FOR WIDE RELEASE
ADMINS = ['aaronsky', 'reid', 'ryan']

Organization = require('../models/organization').get()

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user in ADMINS

  # Org statistics
  robot.router.post '/ibizan/diagnostics/info', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_INFO_TOKEN
      res.status 200
      response = {
        "text": "#{Organization.name}'s Ibizan has been up since
                  #{Organization.initTime.toDate()}
                  (#{+moment()
                    .diff(Organization.initTime, 'minutes', true)
                    .toFixed(2)}
                  minutes)",
        "response_type": "in_channel"
      }
    else
      res.status 401
      response =  {
        "text": "Bad token in Ibizan configuration"
      }
    res.json response

  robot.router.post '/ibizan/diagnostics/users', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_USERS_TOKEN and
       isAdminUser body.user_name
      res.status 200
      response = ''
      for user in Organization.users
        response += user.description() + '\n\n'
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }
    
  robot.router.post '/ibizan/diagnostics/projects', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_PROJECTS_TOKEN and
       isAdminUser body.user_name
      res.status 200
      response = ''
      for project in Organization.projects
        response += project.description() + '\n\n'
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }
    
  robot.router.post '/ibizan/diagnostics/calendar', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_CALENDAR_TOKEN and
       isAdminUser body.user_name
      res.status 200
      response = Organization.calendar.description()
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }
    
  robot.router.post '/ibizan/diagnostics/sync', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_SYNC_TOKEN
      response_url = body.response_url
      if response_url
        Organization.sync()
        .catch(
          (err) ->
            Logger.errorToSlack "Failed to resync", err
            Logger.log "POSTing to #{response_url}"
            payload =
              text: 'Failed to resync'
            robot.http(response_url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(payload))
        )
        .done(
          (status) ->
            Logger.log "Options have been re-loaded"
            Logger.log "POSTing to #{response_url}"
            payload =
              text: 'Re-synced with spreadsheet'
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
        "text": "Bad token in Ibizan configuration"
      }