# Description:
#   Punch your timesheet from the comfort of Slack
#
# Commands:
#   ibizan in - Punch in at the current time and date
#   ibizan out - Punch out at the current time and date
#   ibizan in #project1 - Punch in at the current time and assigns the current project to #project1
#   ibizan out #project1 #project2 - Punch out at the current time and splits the worked time since last in-punch between #project1 and #project2
#   ibizan in 9:15 - Punch in at 9:15am today
#   ibizan out 7pm yesterday - Punch out yesterday at 7pm
#   ibizan in 17:00 #project3 - Punch in at 5pm and assigns the time until next out-punch to #project3
#   ibizan 1.5 hours - Append 1.5 hours to today's total time
#   ibizan 2 hours yesterday - Append 2 hours on to yesterday's total time
#   ibizan 3.25 hours tuesday #project1 - Append 3.25 hours on to Tuesday's total time and assigns it to #project1
#   ibizan vacation today - flags the user’s entire day as vacation time
#   ibizan sick half-day - flags half the user’s day as sick time
#   ibizan vacation half-day yesterday - flags half the user’s previous day (4 hours) as vacation time
#   ibizan sick Jul 6-8
#   ibizan vacation 1/28 - 2/4
#
# Notes:
#   <optional notes required for the script>
#
# Author:
#   aaronsky

# 1. At startup, connect to spreadsheet
# 2. Sync employee list
# 3. Sync project list
# 4. Sync variables
# 5. Start bot

# async steps

# if punch in|out|unpaid|vacation|sick|hours
#   message should be in private channel
#   message word 0 should be the match
#   message word 1 should be:
#     * undefined
#         punch at current time/date
#     * a project
#         if project is defined, punch at current time/date for project
#     * a time
#         punch at the entered time/current date
#     * a time block (absolute date, relative date, half-day. relative date)
#         process block (come back to this)

module.exports = (robot) ->

  Organization = require('../models/organization').get()
  CONSTANTS = require '../helpers/constants'
  REGEX = CONSTANTS.REGEX
  MODES = ['in', 'out', 'vacation', 'unpaid', 'sick']

  canPunchHere = (name, channel) ->
    try
      Organization.clockChannel is channel or name is channel
    catch e
      false

  parse = (res, msg, mode) ->
    if canPunchHere res.message.user.name, res.message.user.room
      user = Organization.getUserBySlackName res.message.user.name
      if not user
        res.send "You aren\'t an employee at #{Organization.name}"
        return
      msg = res.match.input
      msg = msg.replace 'ibizan ', ''
      if mode
        punch = Punch.parse user, msg, mode
      else
        punch = Punch.parse user, msg
      response = finalizePunch punch
      res.send response
    else
      res.send "Talk to me in private about this, please? ;)"

  finalizePunch = (punch) ->
    Organization.spreadsheet.enterPunch punch
    JSON.stringify punch

  # respond to mode
  robot.respond /(in|out|vacation|sick|unpaid)/i, (res) ->
    parse res, res.match.input

  # respond to simple time block
  robot.respond /([0-9]+\.+[0-9]*) hours/i, (res) ->
    parse res, res.match.input, 'none'

