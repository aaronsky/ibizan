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

Logger = require '../helpers/logger'
Organization = require('../models/organization').get()

module.exports = (robot) ->
  
  ADMINS = ['aaronsky', 'reidman']

  isAdminUser = (user) ->
    return user in ADMINS

  isLogChannel = (channel) ->
    return channel is 'ibizan-diagnostics'

  # Org statistics
  robot.respond /!diag/i, (res) ->
    if isLogChannel(res.message.user.room) and
       isAdminUser(res.message.user.name)
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
    if comps[0] is 'users'
      res.send(JSON.stringify(Organization.users))
    else if comps[0] is 'projects'
      res.send(JSON.stringify(Organization.projects))
    else if comps[0] is 'calendar'
      res.send(JSON.stringify(Organization.calendar.holidays))
    else
      info(res)

  make = (res, comps) ->
    if comps[0] is 'report'
      Organization.generateReport()
      .done(
        (numberDone) ->
          res.send "Report generated for #{numberDone} employees"
      )
    else
      info(res)

  reset = (res, comps) ->
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

  info = (res) ->
    res.send "#{Organization.name}'s Ibizan has been up since
               #{Organization.initTime.format()}
               (#{moment().diff(Organization.initTime, 'hours', true)}
               hours)"
