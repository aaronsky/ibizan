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
#   ibizan sick Jul 6-8 - flags July 6-8 of this year as sick time
#   ibizan vacation 1/28 - 2/4 - flags January 28th to February 4th of this year as vacation time.
#
# Notes:
#   All dates are formatted in MM/DD notation with no support for overriding year. Ibizan will extrapolate year from your ranges, even if it stretches over multiple years.
#
# Author:
#   aaronsky

moment = require 'moment-timezone'

constants = require '../helpers/constants'
REGEX = constants.REGEX
TIMEZONE = constants.TIMEZONE
Organization = require('../models/organization').get()
Punch = require '../models/punch'
User = require '../models/user'

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isDM = (name, channel) ->
    name is channel

  isClockChannel = (channel) ->
    channel is Organization.clockChannel

  isProjectChannel = (channel) ->
    return not isClockChannel(channel.room) and
           not isDM(channel.name, channel.room) and
           Organization.getProjectByName(channel.room)?

  canPunchHere = (name, channel) ->
    isDM(name, channel) or
    isClockChannel(channel) or
    isProjectChannel(channel)

  parse = (res, msg, mode) ->
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      Logger.logToChannel "You aren\'t an employee at #{Organization.name}",
                          res.message.user.name
      return
    if canPunchHere res.message.user.name, res.message.user.room
      msg = res.match.input
      msg = msg.replace REGEX.ibizan, ''
      tz = res.message.user.slack.tz
      punch = Punch.parse user, msg, mode, tz
      if not punch.projects.length and
         isProjectChannel res.message.user
        project = Organization.getProjectByName res.message.user.room
        if project?
          punch.projects.push project
      moment.tz.setDefault TIMEZONE
      sendPunch punch, user, res
    else
      user.directMessage "You cannot punch in ##{res.message.user.room}.
                           Try punching in ##{Organization.clockChannel},
                           a designated project channel, or here.",
                         Logger

  sendPunch = (punch, user, res) ->
    if not punch
      Logger.errorToSlack "Somehow, a punch was not generated
                           for \"#{user.slack}\". Punch:\n", res.match.input
      user.directMessage "An unexpected error occured while
                           generating your punch.",
                         Logger
      return
    Organization.spreadsheet.enterPunch(punch, user)
    .then(
      (punch) ->
        Logger.reactToMessage 'dog2',
                              res.message.user.name,
                              res.message.rawMessage.channel,
                              res.message.id
        mode = punch.mode
        if mode is 'vacation' or mode is 'sick' or mode is 'unpaid' or mode is 'none'
          blockTimeQualifier = if punch.times.block? then "#{punch.times.block} hour" else ' '
          if mode is 'none'
            mode = ' block'
          else
            mode = " #{mode}-block"
          modeQualifier = "for a #{blockTimeQualifier}#{mode}"
          timeQualifier = ""
        else
          modeQualifier = mode
          time = punch.times.slice(-1)[0]
          if time.isSame(moment(), 'day')
            dateQualifier = "today"
          else if time.isSame(moment().subtract(1, 'days'), 'day')
            dateQualifier = "yesterday"
          else
            dateQualifier = "on #{time.format('MMM Do, YYYY')}"
          timeQualifier = " at #{time?.format('h:mma')} #{dateQualifier}"
        if punch.elapsed? and not punch.times.block?
          elapsedQualifier = " (#{+punch.elapsed.toFixed(2)} hours)"
        else
          elapsedQualifier = ''
        user.directMessage "Punched you #{modeQualifier}#{timeQualifier}#{elapsedQualifier}.",
                           Logger
    )
    .catch(
      (err) ->
        Logger.error err
        Logger.errorToSlack "\"#{err}\" was returned for
                             #{user.slack}. Punch:\n", res.match.input
        user.directMessage "#{err} You can see more details on the spreadsheet
                             at #{Organization.spreadsheet.url}",
                           Logger
    )
    .done()
      

  # respond to mode
  robot.respond REGEX.modes, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t punch #{res.match[1]}, Organization isn\'t ready yet"
      Logger.logToChannel "The #{Organization.name} isn't ready for
                           operations yet. It may be in the middle of
                           syncing or something has gone horribly wrong.
                           Please try again later, and if this persists
                           longer than five minutes, DM a maintainer as
                           soon as possible.",
                          res.message.user.name
      return
    parse res, res.match.input, res.match[1]

  # respond to simple time block
  robot.respond REGEX.rel_time, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t punch a block, Organization isn\'t ready yet'
      Logger.logToChannel "The #{Organization.name} isn't ready for
                           operations yet. It may be in the middle of
                           syncing or something has gone horribly wrong.
                           Please try again later, and if this persists
                           longer than five minutes, DM a maintainer as
                           soon as possible.",
                          res.message.user.name
      return
    # moment.tz.setDefault res.message.user.slack.tz
    parse res, res.match.input, 'none'

  robot.respond REGEX.append, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t append to punch, Organization isn\'t ready yet'
      Logger.logToChannel "The #{Organization.name} isn't ready for
                           operations yet. It may be in the middle of
                           syncing or something has gone horribly wrong.
                           Please try again later, and if this persists
                           longer than five minutes, DM a maintainer as
                           soon as possible.",
                          res.message.user.name
      return
    msg = res.match.input
    msg = msg.replace REGEX.ibizan, ''
    msg = msg.replace REGEX.append, ''
    msg = msg.trim()
    if user = Organization.getUserBySlackName res.message.user.name
      if punch = user.lastPunch 'in'
        words = msg.split ' '
        op = words[0]
        words.shift()
        msg = words.join(' ').trim()
        if op is 'project' or
           op is 'projects'
          projects = msg.split ' '
          if projects.length is 0 and
             isProjectChannel res.message.user.room
            projects.push Organization.getProjectByName(res.message.user.room)
          punch.appendProjects projects
        else if op is 'note' or
                op is 'notes'
          punch.appendNotes msg
        row = punch.toRawRow user.name
        row.save (err) ->
          if err
            user.directMessage err,
                               Logger
          else
            Logger.reactToMessage 'dog2',
                                  res.message.user.name,
                                  res.message.rawMessage.channel,
                                  res.message.id

  robot.respond /undo/i, (res) ->
    if not Organization.ready()
      Logger.warn 'Don\'t undo, Organization isn\'t ready yet'
      Logger.logToChannel "The #{Organization.name} isn't ready for
                           operations yet. It may be in the middle of
                           syncing or something has gone horribly wrong.
                           Please try again later, and if this persists
                           longer than five minutes, DM a maintainer as
                           soon as possible.",
                          res.message.user.name
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      Logger.logToChannel "#{res.message.user.name} isn't a recognized
                           username. Either you aren't part of the
                           Employee worksheet, something has gone
                           horribly wrong, or you aren\'t an employee
                           at #{Organization.name}.",
                          res.message.user.name
      return
    if user.punches and user.punches.length > 0
      user.undoPunch()
      .then(
        () ->
          user.directMessage 'Undid your last punch action',
                             Logger
      )
      .catch(
        (err) ->
          Logger.errorToSlack "\"#{err}\" was returned for
                               an undo operation by #{user.slack}"
          user.directMessage "Something went horribly wrong while
                              undoing your punch.",
                             Logger
      )
      .done()
    else
      user.directMessage 'There\'s nothing for me to undo.',
                         Logger


