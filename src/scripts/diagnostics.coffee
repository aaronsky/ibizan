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

Organization = require('../models/organization').get()

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user.is_admin

  isLogChannel = (channel) ->
    return channel is 'ibizan-diagnostics'

  # Org statistics
  robot.respond /!diag/i, (res) ->
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
        list(res, [comps[1]])
      else if comps[0] is 'make'
        make(res, [comps[1]])
      else if comps[0] is 'reset'
        reset(res, [comps[1]])
      else if comps[0] is 'sync' or comps[0] is 'resync'
        reset(res, ['org'])
      else
        info(res)

  list = (res, comps) ->
    comps = comps || []
    if comps[0] is 'users'
      res.send(JSON.stringify(Organization.users))
    else if comps[0] is 'projects'
      res.send(JSON.stringify(Organization.projects))
    else if comps[0] is 'calendar'
      res.send(JSON.stringify(Organization.calendar.holidays))
    else
      info(res)

  make = (res, comps) ->
    comps = comps || []
    if comps[0] is 'report'
      Organization.generateReport()
      .done(
        (numberDone) ->
          res.send "Salary report generated for #{numberDone} employees."
      )
    else
      info(res)
      help(res)

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
