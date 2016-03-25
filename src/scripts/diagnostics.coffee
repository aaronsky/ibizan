# Description:
#   Your dog friend makes sure everything's in order
#
# Commands:
#   ibizan !diag - Get org name and server time
#   ibizan !diag list <users|projects|calendar> - Get a list of all users/projects/holidays in the org
#   ibizan !diag make report <start (MM/DD/YYYY)> <end (MM/DD/YYYY)> - Generate salary report between optional range
#   ibizan !diag reset hound - Reset hound status for all org members
#   ibizan !diag reset org - Resync org data stores with spreadsheet
#   ibizan !diag sync - See `reset org`
#   ibizan !diag resync - See `reset org`
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
      response = "#{Organization.name}'s Ibizan has been up since
                  #{Organization.initTime.toDate()}
                  (#{+moment()
                    .diff(Organization.initTime, 'minutes', true)
                    .toFixed(2)}
                  minutes)"
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "response_type": "in_channel",
      "text": response
    }

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
    
  robot.router.post '/ibizan/diagnostics/resethounding', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_RESETHOUNDING_TOKEN and
       isAdminUser body.user_name
      res.status 200
      count = Organization.resetHounding()
      response = "Reset #{count}
                  #{if count is 1 then "person's" else "peoples'"}
                  hound status"
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }

  robot.router.post '/ibizan/diagnostics/payroll', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_SYNC_TOKEN and
       isAdminUser body.user_name
      comps = body.text || []
      start = if comps[0] then moment comps[0] else moment().subtract 2, 'weeks'
      end = if comps[1] then moment comps[1] else moment()
      Organization.generateReport(start, end)
      .catch((err) ->
        res.status 500
        res.json {
          "text": "Failed to produce a salary report"
        }
      )
      .done(
        (numberDone) ->
          res.status 200
          res.json {
            "text": "Salary report generated for #{numberDone} employees"
          }
      )
    else
      res.status 401
      res.json {
        "text": "Bad token in Ibizan configuration"
      }
    
  robot.router.post '/ibizan/diagnostics/sync', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_SYNC_TOKEN
      Organization.sync()
      .catch((err) ->
        res.status 500
        res.json {
          "text": "Failed to resync"
        }
      )
      .done((status) ->
        res.status 200
        res.json {
          "text": "Re-synced with spreadsheet"
        }
      )
    else
      res.status 401
      res.json {
        "text": "Bad token in Ibizan configuration"
      }

  # User feedback
  robot.respond /(today|(for today)|hours)$/i, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t output diagnostics, Organization isn\'t ready yet"
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      Logger.logToChannel "You aren\'t an employee at #{Organization.name}",
                          res.message.user.name
      return
    report = user.toRawPayroll(moment({hour: 0, minute: 0, second: 0}),
                               moment())
    headers = HEADERS.payrollreports
    loggedAny = false
    if not report[headers.logged] and
       not report[headers.vacation] and
       not report[headers.sick] and
       not report[headers.unpaid]
      msg = 'You haven\'t recorded any hours today.'
    else
      if not report[headers.logged]
        msg = 'You haven\'t recorded any paid work time'
      else
        msg = "You have #{report[headers.logged]} hours of paid work time"
        loggedAny = true
      for kind in ['vacation', 'sick', 'unpaid']
        header = headers[kind]
        if kind is 'unpaid'
          kind = 'unpaid work'
        if report[header]
          if not loggedAny
            msg += ", but you have #{report[header]} hours of #{kind} time"
            loggedAny = true
          else
            msg += " and #{report[header]} hours of #{kind} time"
      msg += ' recorded for today.'
    Logger.logToChannel msg, res.message.user.room