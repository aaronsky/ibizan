# Description:
#   Your dog friend is running tasks on a schedule
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
  # Weeks ‘start’ on Sunday morning.

  robot.adapter.client.on 'raw_message', (res) ->
    if res and res.type is 'team_join'
      if user = res.user
        Logger.log "The new user #{user.name} has joined #{Organization.name}!"
        raw_user =
          slackusername: user.name
          employeename: user.real_name
          salary: 'N'
          activehoursbegin: '8:00 AM'
          activehoursend: '5:00 PM'
          timezone: user.tz
          totalvacationdaysavailable: '13'
          totalvacationdayslogged: '0'
          totalsickdaysavailable: '5'
          totalsickdayslogged: '0'
          totalunpaiddayslogged: '0'
          totalovertime: '0'
          totalloggedhours: '0'
          averagehoursloggedweek: '0'
        if not Organization.ready()
          # add at next opportunity
          Logger.warn "Organization isn't ready yet"
          return
        Organization.spreadsheet.employees.addRow raw_user, (err) ->
          if err
            Logger.errorToSlack "Couldn't add row", err
            return
          Organization.sync()
          .done(() ->
            user = Organization.getUserBySlackName raw_user.slackusername
            if user
              user.directMessage "Welcome to Slack! I'm #{Organization.name}'s
                                  resident dog-themed timesheet-tracker,
                                  Ibizan!\n\n

                                  To clock in, try doing `@ibizan in` in
                                  #timeclock, or here without the `@ibizan`.
                                  This will clock you in for the current
                                  time. If you want to clock in at a
                                  particular time, you can do `@ibizan in 12pm`.
                                  If you want to clock in a block of time,
                                  try `@ibizan 3 hours`.\n\n

                                  To clock out, just do `@ibizan out`.",
                                 Logger
          )
        