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
    Organization.generateReport()

  # Users should receive a DM “chime” every other Friday afternoon to
  # inform them that payroll runs on Monday, and that unaccounted-for
  # time will not be paid.
  reminderJob = schedule.scheduleJob '0 13 * * 5', () ->
    # TODO: This should be a DM
    robot.sendMessage "Payroll will run on Monday.
                       Unrecorded time will not be paid"

# Follow up on:
# Ibizan should only accept check-ins, check-outs, and time logs in the
# ‘Time Logging Channel’ specified in the ‘Variables’ tab on the Ibizan
# spreadsheet. Ibizan should not accept logging attempts via DM or any
# other Slack channel.

# When given a command, Ibizan should always responds
# (in the channel) to confirm.
  # When checking out or logging blocks of time, the entry should be
  # read back along with the latest totals.
  # e.g.
  # 3.25 hours logged today / Today’s total: 5.5 hours / Week total: 40 hours
