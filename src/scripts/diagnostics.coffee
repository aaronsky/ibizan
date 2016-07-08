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

Organization = require('../models/organization').get()

helpEnglish = "*Ibizan Help*\n
              \n
              To clock in with Ibizan, either @mention him in a public
              channel, use the slash command, or DM him directly without
              the @mention. Your command should follow this format:\n
              \n
              `@ibizan [mode] [time] [date] [project] [notes]`\n
              \n
              Examples:\n
              @ibizan in\n
              @ibizan out\n
              @ibizan in at 9:15\n
              @ibizan out 4:30p yesterday\n
              @ibizan in #project-name\n
              @ibizan 3.5 hours today\n
              \n
              Punches can be `in`, `out`, `vacation`, `sick` or `unpaid`
              punches. You can also clock in independent blocks of time.
              Projects must be registered in the worksheet labeled
              'Projects' in the Ibizan spreadsheet, and won't be recognized
              as projects in a command without a pound-sign
              (i.e. #fight-club).\n
              \n
              If something is wrong with your punch, you can undo it by
              doing `@ibizan undo`. You can also modify it manually using
              the Ibizan spreadsheet, in the worksheet labeled 'Raw Data'.
              If you want to see how much time you've worked today, do
              `@ibizan today?`.\n
              \n
              If you make any manual changes to the spreadsheet, you should
              run `/sync` or `@ibizan sync`. Running this resyncs Ibizan with
              the spreadsheet.\n
              \n
              Due to some existing limitations in Google Sheets, changes
              made directly to the spreadsheet are not immediately
              reflected by Ibizan and must be followed up with a `/sync`.\n
              \n
              For more documentation, please check out
              https://github.com/ibizan/ibizan.github.io/wiki"

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
    if body.token is process.env.SLASH_USERS_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = 'You must be an admin in order to access this command.'
      else
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
    if body.token is process.env.SLASH_PROJECTS_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = 'You must be an admin in order to access this command.'
      else
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
    if body.token is process.env.SLASH_CALENDAR_TOKEN
      if not isAdminUser body.user_name
        res.status 403
        response = 'You must be an admin in order to access this command.'
      else
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
        "text": "Bad token in Ibizan configuration"
      }

  robot.respond /sync/i, (res) ->
    Organization.sync()
    .catch(
      (err) ->
        Logger.errorToSlack "Failed to resync", err
    )
    .done(
      (status) ->
        Logger.logToChannel "Resynced with spreadsheet",
                            res.message.user.name
    )
    Logger.reactToMessage 'dog2',
                          res.message.user.name,
                          res.message.rawMessage.channel,
                          res.message.id

  robot.router.post '/ibizan/diagnostics/help', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_HELP_TOKEN
      res.status 200
      response = helpEnglish
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }

  robot.respond /help/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    user.directMessage helpEnglish, Logger
