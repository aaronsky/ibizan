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
schedule = require 'node-schedule'

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)
  Organization = require('../models/organization').get()
  # Weeks ‘start’ on Sunday morning.
  
  # Ibizan will export a Payroll Report every other Sunday night.
  generateReportJob = schedule.scheduleJob '0 17 * * 0', () ->
    if not Organization.ready()
      Logger.log "Don\'t make scheduled payroll report,
                  Organization isn\'t ready yet"
      return
    twoWeeksAgo = moment().subtract(2, 'weeks')
    today = moment()
    Organization.generateReport(twoWeeksAgo, today)
      .catch((err) ->
        Logger.errorToSlack "Failed to produce a salary report", err
      )
      .done(
        (numberDone) ->
          Logger.logToChannel "Salary report generated for
                               #{numberDone} employees",
                              'ibizan-diagnostics'
      )

  # Users should receive a DM “chime” every other Friday afternoon to
  # inform them that payroll runs on Monday, and that unaccounted-for
  # time will not be paid.
  reminderJob = schedule.scheduleJob '0 13 * * 5', () ->
    if not Organization.ready()
      Logger.log "Don\'t run scheduled payroll reminder,
                  Organization isn\'t ready yet"
      return
    for user in Organization.users
      user.directMessage "As a reminder, payroll will run on Monday.
                          Unrecorded time will not be paid.",
                         Logger
