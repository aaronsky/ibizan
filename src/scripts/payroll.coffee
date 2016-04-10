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
  HEADERS = require('../helpers/constants').HEADERS
  Logger = require('../helpers/logger')(robot)
  Organization = require('../models/organization').get()
  # Weeks ‘start’ on Sunday morning.
  
  generateDailyReportJob = schedule.scheduleJob '0 6 * * *', ->
    if not Organization.ready()
      Logger.warn "Don\'t make scheduled daily report,
                  Organization isn\'t ready yet"
      return
    today = moment({hour: 0, minute: 0, second: 0})
    yesterday = moment(today).subtract(1, 'days')
    Organization.generateReport(yesterday, today)
      .catch((err) ->
        Logger.errorToSlack "Failed to produce a daily report", err
      )
      .done(
        (reports) ->
          numberDone = reports.length
          PAYROLL = HEADERS.payrollreports
          response = "DAILY WORK LOG: #{yesterday.format('dddd MMMM D YYYY').toUpperCase()}\n"
          logBuffer = ''
          offBuffer = ''

          for report in reports
            recorded = false
            if report[PAYROLL.logged] > 0
              status = "#{report.extra.slack}:\t#{report[PAYROLL.logged]} hours"
              notes = report.extra.notes?.replace('\n', '; ')
              if notes
                status += " \"#{notes}\""
              projectStr = ''
              if report.extra.projects? and report.extra.projects?.length > 0
                for project in report.extra.projects
                  projectStr += "##{project.name} "
              if projectStr
                projectStr = projectStr.trim()
                status += " #{projectStr}"
              status += "\n"
              logBuffer += "#{status}"
              recorded = true
            if report[PAYROLL.vacation] > 0
              offBuffer += "#{report.extra.slack}:\t#{report[PAYROLL.vacation]} hours unpaid"
              recorded = true
            if report[PAYROLL.sick] > 0
              offBuffer += "#{report.extra.slack}:\t#{report[PAYROLL.sick]} hours unpaid"
              recorded = true
            if report[PAYROLL.unpaid] > 0
              offBuffer += "#{report.extra.slack}:\t#{report[PAYROLL.unpaid]} hours unpaid"
              recorded = true
            if not recorded
              offBuffer += "#{report.extra.slack}:\t0 hours\n"

          response += logBuffer
          if offBuffer.length > 0
            response += "DAILY OFF-TIME LOG: #{yesterday.format('dddd MMMM D YYYY').toUpperCase()}\n"
            response += offBuffer
          Logger.logToChannel response,
                              'general'
          Logger.logToChannel "Daily report generated for
                               #{numberDone} employees",
                              'ibizan-diagnostics'
      )


  # Ibizan will export a Payroll Report every other Sunday night.
  generatePayrollReportJob = schedule.scheduleJob '0 17 * * 0', ->
    if not Organization.ready()
      Logger.warn "Don\'t make scheduled payroll report,
                  Organization isn\'t ready yet"
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

  # Users should receive a DM “chime” every other Friday afternoon to
  # inform them that payroll runs on Monday, and that unaccounted-for
  # time will not be paid.
  reminderJob = schedule.scheduleJob '0 13 * * 5', ->
    if not Organization.ready()
      Logger.warn "Don\'t run scheduled payroll reminder,
                  Organization isn\'t ready yet"
      return
    for user in Organization.users
      user.directMessage "As a reminder, payroll will run on Monday.
                          Unrecorded time will not be paid.",
                         Logger
