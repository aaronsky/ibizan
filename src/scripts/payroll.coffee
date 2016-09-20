# Description:
#   Your dog friend is running tasks on a schedule
#
# Commands:
#
# Notes:
#   Weeks ‘start’ on Sunday morning.
#
# Author:
#   aaronsky

moment = require 'moment'
schedule = require 'node-schedule'

{ HEADERS, STRINGS, TIMEZONE } = require('../helpers/constants')
Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  generateDailyReportJob = schedule.scheduleJob '0 9 * * *', ->
    if not Organization.ready()
      Logger.warn "Don't make scheduled daily report,
                   Organization isn't ready yet"
      return
    yesterday =
      moment.tz({hour: 0, minute: 0, second: 0}, TIMEZONE).subtract(1, 'days')
    today = moment.tz({hour: 0, minute: 0, second: 0}, TIMEZONE)
    Organization.generateReport(yesterday, today)
      .catch((err) ->
        Logger.errorToSlack "Failed to produce a daily report", err
      )
      .done(
        (reports) ->
          numberDone = reports.length
          report = Organization.dailyReport reports, today, yesterday
          Logger.logToChannel report,
                              'bizness-time'
          Logger.logToChannel "Daily report generated for
                               #{numberDone} employees",
                              'ibizan-diagnostics'
      )

  # Ibizan will export a Payroll Report every other Sunday night.
  generatePayrollReportJob = schedule.scheduleJob '0 20 * * 0', ->
    if not Organization.calendar.isPayWeek()
      Logger.warn "Don't run scheduled payroll reminder,
                   it isn't a pay-week."
      return
    twoWeeksAgo = moment().subtract(2, 'weeks')
    today = moment()
    Organization.generateReport(twoWeeksAgo, today, true)
      .catch((err) ->
        Logger.errorToSlack "Failed to produce a salary report", err
      )
      .done(
        (reports) ->
          numberDone = reports.length
          Logger.logToChannel "Salary report generated for
                               #{numberDone} employees",
                              'ibizan-diagnostics'
      )

  robot.respond /payroll\s*(.*)?$/i, id: 'payroll.payroll', userRequired: true, adminOnly: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    dates = res.match[1]
    if dates?
      dates = dates.split ' '
    if dates? and dates[0] and not dates[1]
      user.directMessage "You must provide both a start and end date.", Logger
      Logger.addReaction 'x', res.message
    else
      start = if dates? and dates[0] then moment(dates[0], "MM/DD/YYYY") else moment().subtract(2, 'weeks')
      end =
        if dates? and dates[1] then moment(dates[1], "MM/DD/YYYY") else moment()
      Organization.generateReport(start, end, true)
      .catch(
        (err) ->
          response = "Failed to produce a salary report: #{err}"
          user.directMessage response, Logger
          Logger.error response
      )
      .done(
        (reports) ->
          numberDone = reports.length
          response = "Payroll has been generated for #{numberDone} employees
                      from #{start.format('dddd, MMMM D, YYYY')}
                      to #{end.format('dddd, MMMM D, YYYY')}"
          user.directMessage response, Logger
          Logger.log response
      )
      Logger.addReaction 'dog2', res.message

  # Users should receive a DM “chime” every other Friday afternoon to
  # inform them that payroll runs on Monday, and that unaccounted-for
  # time will not be paid.
  reminderJob = schedule.scheduleJob '0 13 * * 5', ->
    if not Organization.calendar.isPayWeek()
      Logger.warn "Don't run scheduled payroll reminder,
                   it isn't a pay-week."
      return
    for user in Organization.users
      user.directMessage "As a reminder, payroll will run on Monday.
                          Unrecorded time will not be paid.\n
                          You can use `period?` to check your hours
                          for this pay period.",
                         Logger
