# Description:
#   Punch your timesheet from the comfort of Slack
#
# Commands:
#   ibizan in - Punch in at the current time and date
#   ibizan out - Punch out at the current time and date
#   ibizan in #project1 - Punch in at the current time and
#                         assigns the current project to #project1
#   ibizan out #project1 #project2 - Punch out at the current time and
#                                    splits the worked time since last
#                                    in-punch between #project1 and
#                                    #project2
#   ibizan in 9:15 - Punch in at 9:15am today
#   ibizan out 7pm yesterday - Punch out yesterday at 7pm
#   ibizan in 17:00 #project3 - Punch in at 5pm and assigns the time
#                               until next out-punch to #project3
#   ibizan 1.5 hours - Append 1.5 hours to today's total time
#   ibizan 2 hours yesterday - Append 2 hours on to yesterday's total time
#   ibizan 3.25 hours tuesday #project1 - Append 3.25 hours on to
#                                         Tuesday's total time and
#                                         assigns it to #project1
#   ibizan vacation today - flags the user’s entire day as vacation time
#   ibizan sick half-day - flags half the user’s day as sick time
#   ibizan vacation half-day yesterday - flags half the user’s previous
#                                        day (4 hours) as vacation time
#   ibizan sick Jul 6-8
#   ibizan vacation 1/28 - 2/4
#
# Notes:
#   <optional notes required for the script>
#
# Author:
#   aaronsky

constants = require '../helpers/constants'
REGEX = constants.REGEX
Organization = require('../models/organization').get()
Punch = require('../models/punch')

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)
  
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
        Logger.logToChannel "You aren\'t an employee at #{Organization.name}",
                            res.message.user.name
        return
      msg = res.match.input
      msg = msg.replace REGEX.ibizan, ''
      punch = Punch.parse user, msg, mode
      if not punch.projects.length and isProjectChannel res.message.user.room
        punch.projects.push Organization.getProjectByName(res.message.user.room)
      sendPunch punch, user, res
    else
      Logger.logToChannel "You cannot punch in ##{res.message.user.room}.
       Try punching in ##{Organization.clockChannel},
       a designated project channel, or here.", res.message.user.name

  sendPunch = (punch, user, res) ->
    if not punch
      Logger.errorToSlack "Somehow, a punch was not generated for \"#{res.match.input}\"", JSON.stringify(user)
      Logger.logToChannel "An unexpected error occured while generating your punch.", res.message.user.name
      return
    Organization.spreadsheet.enterPunch(punch, user)
    .then(
      () ->
        client = robot.adapter.client
        params = {
          "name": "dog2",
          "channel": res.message.rawMessage.channel,
          "timestamp": res.message.id
        }
        client._apiCall 'reactions.add', params, (response) ->
          if not response.ok
            Logger.logToChannel response.error, res.message.user.name
    )
    .catch(
      (err) ->
        Logger.error err
        Logger.errorToSlack "\"#{err}\" was returned for #{res.match.input}", JSON.stringify(user)
        Logger.logToChannel err, res.message.user.name
    )
    .done()
      

  # respond to mode
  robot.respond REGEX.modes, (res) ->
    parse res, res.match.input, res.match[1]

  # respond to simple time block
  robot.respond REGEX.rel_time, (res) ->
    parse res, res.match.input, 'none'

  robot.respond /undo/i, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    if user.lastPunch
      user.undoPunch()
      .then(
        () ->
          Logger.logToChannel 'Undid your last punch action',
           res.message.user.name
      )
      .catch(
        (err) ->
          console.error err
          Logger.errorToSlack "\"#{err}\" was returned for an undo operation by: ", JSON.stringify(user)
          Logger.logToChannel "Something went wrong while undoing your punch.",
           res.message.user.name
      )
      .done()
    else
      Logger.logToChannel 'There\'s nothing for me to undo.',
       res.message.user.name


