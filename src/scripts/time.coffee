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
  Punch = require('../models/punch')
  CONSTANTS = require '../helpers/constants'
  REGEX = CONSTANTS.REGEX

  isDM = (name, channel) ->
    name is channel

  isClockChannel = (channel) ->
    channel is Organization.clockChannel

  isProjectChannel = (channel) ->
    Organization.getProjectByName(channel)?

  canPunchHere = (name, channel) ->
    isDM(name, channel) or 
    isClockChannel(channel) or 
    isProjectChannel(channel)

  parse = (res, msg, mode) ->
    if canPunchHere res.message.user.name, res.message.user.room
      user = Organization.getUserBySlackName res.message.user.name
      if not user
        res.send "You aren\'t an employee at #{Organization.name}"
        return
      msg = res.match.input
      msg = msg.replace REGEX.ibizan, ''
      punch = Punch.parse user, msg, mode
      if not punch.projects.length and isProjectChannel res.message.user.room
        punch.projects.push Organization.getProjectByName(res.message.user.room)
      sendPunch punch, user, res
    else
      res.send "Talk to me in private about this, please? ;)"

  sendPunch = (punch, user, res) ->
    if not punch
      cb(new Error('Punch could not be parsed :('), null)
      return
    Organization.spreadsheet.enterPunch punch, user, (err) ->
      if err
        # dm user with error???
        return
      client = robot.adapter.client
      params = {
        "name": "dog2",
        "channel": res.message.rawMessage.channel,
        "timestamp": res.message.id
      }
      client._apiCall 'reactions.add', params, (response) ->
        if not response.ok
          res.send response.error

  # respond to mode
  robot.respond REGEX.modes, (res) ->
    parse res, res.match.input, res.match[1]

  # respond to simple time block
  robot.respond REGEX.rel_time, (res) ->
    parse res, res.match.input, 'none'

  robot.respond /undo/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    if user.lastPunch
      user.lastPunch.row.del (err) ->
        if err
          res.send 'Something went wrong with your undo request'
          console.error err
          return
        user.lastPunch = null
    else
      res.send 'There\'s nothing for me to undo'


