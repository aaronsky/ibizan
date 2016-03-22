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

Organization = require('../models/organization').get()

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user.is_admin

  isLogChannel = (channel) ->
    return channel is 'ibizan-diagnostics'

  # Org statistics
  robot.respond /!diag/i, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t output diagnostics, Organization isn\'t ready yet"
      return
    if not isLogChannel(res.message.user.room)
      res.send "This isn\'t the diagnostics channel.
                If you want to check up on me,
                please visit #ibizan-diagnostics."
    else if not isAdminUser(res.message.user.slack) and
                res.message.user.name isnt 'aaronsky'
      Logger.logToChannel 'You don\'t have permission to
                           issue diagnostic commands.',
                           'ibizan-diagnostics'
    if isLogChannel(res.message.user.room) and
       (isAdminUser(res.message.user.slack) or
       res.message.user.name is 'aaronsky')
      msg = res.match.input
      comps = msg.split(' ')
      comps.shift()
      comps.shift()
      if comps[0] is 'list'
        comps.shift()
        list(res, comps)
      else if comps[0] is 'make'
        comps.shift()
        make(res, comps)
      else if comps[0] is 'reset'
        comps.shift()
        reset(res, comps)
      else if comps[0] is 'sync' or comps[0] is 'resync'
        reset(res, ['org'])
      else
        info(res)

  list = (res, comps) ->
    comps = comps || []
    if comps[0] is 'users'
      str = ''
      for user in Organization.users
        str += user.description() + '\n\n'
      res.send str
    else if comps[0] is 'projects'
      str = ''
      for project in Organization.projects
        str += project.description() + '\n\n'
      res.send str
    else if comps[0] is 'calendar'
      res.send(Organization.calendar.description())
    else
      info(res)

  make = (res, comps) ->
    comps = comps || []
    if comps[0] is 'report'
      if comps.length is 3
        start = moment comps[1]
        end = moment comps[2]
      else if comps.length is 2
        start = moment comps[1]
        end = moment()
      else
        start = moment().subtract 2, 'weeks'
        end = moment()
      Organization.generateReport(start, end)
      .done(
        (numberDone) ->
          res.send "Salary report generated for #{numberDone} employees."
      )
    else
      info(res)

  reset = (res, comps) ->
    comps = comps || []
    if comps[0] is 'hounding' or comps[0] is 'hound'
      count = Organization.resetHounding()
      res.send "Reset #{count}
                 #{if count is 1 then "person's" else "peoples'"}
                 hound status"
    else if comps[0] is 'org'
      Organization.sync()
      .catch((err) -> res.send "Failed to resync.")
      .done((status) ->
        res.send "Re-synced with spreadsheet"
      )
    else
      info(res)
      help(res)

  info = (res) ->
    res.send "#{Organization.name}'s Ibizan has been up since
               #{Organization.initTime.toDate()}
               (#{+moment()
                  .diff(Organization.initTime, 'minutes', true)
                  .toFixed(2)}
               minutes)"

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
    report = user.toRawPayroll(moment({hour: 0, minute: 0, second: 0}), moment())
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