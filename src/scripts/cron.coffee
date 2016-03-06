# Description:
#   Your dog friend is running tasks on a schedule
#
# Commands:
#
# Notes:
#
# Author:
#   aaronsky

schedule = require 'node-schedule'

Organization = require('../models/organization').get()

module.exports = (robot) ->
  # Weeks ‘start’ on Sunday morning.
  
  # Every morning, reset hound status for each users
  resetHoundJob = schedule.scheduleJob '0 6 * * 1-5', () ->
    Organization.resetHounding()

  # Ibizan will export a Payroll Report every other Sunday night.
  generateReportJob = schedule.scheduleJob '0 17 * * 0', () ->
    today = moment()
    twoWeeksAgo = today.subtract(2, 'weeks')
    Organization.generateReport twoWeeksAgo, today

  # Users should receive a DM “chime” every other Friday afternoon to
  # inform them that payroll runs on Monday, and that unaccounted-for
  # time will not be paid.
  reminderJob = schedule.scheduleJob '0 13 * * 5', () ->
    # TODO: This should be a DM
    robot.sendMessage "Payroll will run on Monday.
                       Unrecorded time will not be paid"
