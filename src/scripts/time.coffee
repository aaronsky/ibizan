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

{ REGEX, HEADERS, STRINGS, TIMEZONE } = require '../helpers/constants'
Organization = require('../models/organization').get()
Punch = require '../models/punch'
Q = require 'q'
User = require '../models/user'
strings = STRINGS.time

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isDM = (channel) ->
    channelname = channel.toString()
    channelname.substring(0,1) is 'D'

  isClockChannel = (channel) ->
    chan = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById channel
    return chan.name is Organization.clockChannel

  isProjectChannel = (channel) ->
    chan = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById channel
    return not isClockChannel(channel) and
           not isDM(channel) and
           Organization.getProjectByName(chan.name)?

  canPunchHere = (channel) ->
    isDM(channel) or
    isClockChannel(channel) or
    isProjectChannel(channel)

  toTimeStr = (duration) ->
    hours = Math.floor duration
    if hours is 0
      hoursStr = ''
    else if hours is 1
      hoursStr = "#{hours} hour"
    else
      hoursStr = "#{hours} hours"
    minutes = Math.round((duration - hours) * 60)
    if minutes is 0
      minutesStr = ''
    else if minutes is 1
      minutesStr = "#{minutes} minute"
    else
      minutesStr = "#{minutes} minutes"
    return "#{hoursStr}#{if hours > 0 and minutes > 0 then ', ' else ''}#{minutesStr}"

  parse = (res, msg, mode) ->
    mode = mode.toLowerCase()
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      Logger.addReaction 'x', res.message
      return
    Logger.log "Parsing '#{msg}' for @#{user.slack}."
    if canPunchHere res.message.room
      Logger.addReaction 'clock4', res.message
      msg = res.match.input
      msg = msg.replace REGEX.ibizan, ''
      tz = res.message.user.tz
      punch = Punch.parse user, msg, mode, tz
      if not punch.projects.length and
         isProjectChannel res.message.room
        project = Organization.getProjectByName res.message.room
        if project?
          punch.projects.push project
      moment.tz.setDefault TIMEZONE

      if punch.mode is 'none'
        modeQualifier = 'block'
      else
        modeQualifier = punch.mode
      if punch.mode is 'none' or
         punch.mode is 'vacation' or
         punch.mode is 'sick'
        article = 'a'
      else
        article = 'an'
      Logger.log "Successfully generated #{article} #{modeQualifier}-punch
                  for @#{user.slack}: #{punch.description(user)}"

      sendPunch punch, user, res
    else
      channelName = Logger.getChannelName res.message.user.room
      if res.router_res
        res.router_res.status 500
        res.router_res.json {
          "text": "You cannot punch in ##{channelName}.
                   Try punching in ##{Organization.clockChannel},
                   a designated project channel, or here."
        }
      else
        Logger.addReaction 'x', res.message
        user.directMessage "You cannot punch in ##{channelName}.
                            Try punching in ##{Organization.clockChannel},
                            a designated project channel, or here.",
                           Logger

  sendPunch = (punch, user, res) ->
    if not punch
      if res.router_res
        res.router_res.status 500
        res.router_res.json {
          "text": "An unexpected error occured while
                    generating your punch."
        }
      else
        Logger.errorToSlack "Somehow, a punch was not generated
                             for \"#{user.slack}\". Punch:\n", res.match.input
        user.directMessage "An unexpected error occured while
                            generating your punch.",
                           Logger
      return
    Organization.spreadsheet.enterPunch(punch, user)
    .then(
      (punch) ->
        Logger.log "@#{user.slack}'s punch was successfully entered
                    into the spreadsheet."
        punchEnglish = "Punched you *#{punch.description(user)}*."
        if res.router_res
          res.router_res.status 200
          res.router_res.json {
            "text": punchEnglish
          }
        else
          user.directMessage punchEnglish, Logger
          Logger.addReaction 'dog2', res.message
          Logger.removeReaction 'clock4', res.message
    )
    .catch(
      (err) ->
        if res.router_res
          res.router_res.status 500
          res.router_res.json {
            "text": "#{err} - You can see more details on the spreadsheet
                      at #{Organization.spreadsheet.url}"
          }
        else
          errorMsg = Logger.clean err
          Logger.error errorMsg
          Logger.errorToSlack "\"#{errorMsg}\" was returned for
                               #{user.slack}. Punch:\n", res.match.input
          user.directMessage "\n#{errorMsg}\nYou can see more details on 
                              <#{Organization.spreadsheet.url}|the spreadsheet>.",
                             Logger
          Logger.addReaction 'x', res.message
          Logger.removeReaction 'clock4', res.message
    )
    .done()

  # respond to mode
  robot.respond REGEX.modes, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t punch #{res.match[1]}, Organization isn\'t ready yet"
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    parse res, res.match.input, res.match[1]

  # respond to simple time block
  robot.respond REGEX.rel_time, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t punch a block, Organization isn\'t ready yet'
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    parse res, res.match.input, 'none'

  robot.router.post '/ibizan/punch', (req, res) ->
    if not Organization.ready()
      Logger.log 'Don\'t punch via slash command, Organization isn\'t ready yet'
      res.json {
        "text": strings.orgnotready
      }
      return
    body = req.body
    if body.token is process.env.SLASH_PUNCH_TOKEN
      msg = body.text
      channel_name = body.channel_name?.replace('#', '')
      if channel_name and channel_name is 'directmessage'
        channel_name = body.user_name
      response = {
        match: {
          input: msg
        },
        message: {
          user: {
            name: body.user_name,
            room: channel_name,
            slack: {
              tz: TIMEZONE
            }
          }
        },
        router_res: res
      }
      if match = msg.match REGEX.rel_time
        mode = 'none'
      else if match = msg.match REGEX.modes
        mode = msg.split(' ')[0]
      else
        res.status 500
        response = 'No mode could be extrapolated from your punch.'
        res.json {
          "text": response
        }
        return
      parse response, msg, mode
    else
      res.status 401
      res.json  {
        "text": "Bad token in Ibizan configuration"
      }

  robot.respond /(append|add)/i, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t append to punch, Organization isn\'t ready yet'
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      Logger.addReaction 'x', res.message
      return
    punch = user.lastPunch 'in'
    if not punch
      user.directMessage "Based on my records, I don't think you're
                          punched in right now. If this is in error, run
                          `/sync` and try your punch again, or DM a
                          maintainer as soon as possible.",
                          Logger
      return
    msg = res.match.input
    msg = msg.replace REGEX.ibizan, ''
    msg = msg.replace /(append|add)/i, ''
    msg = msg.trim()

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
    Organization.spreadsheet.saveRow(row)
    .catch(
      (err) ->
        user.directMessage err, Logger
        Logger.error 'Unable to append row', new Error(err)
    ).done(
      projectsQualifier = projects?.join(', ') ? ''
      notesQualifier = "'#{msg}'"
      user.directMessage "Added #{op}: #{projectsQualifier}#{notesQualifier}",
                         Logger
      Logger.addReaction 'dog2', res.message
    )

  robot.respond /undo/i, (res) ->
    if not Organization.ready()
      Logger.warn 'Don\'t undo, Organization isn\'t ready yet'
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      return
    if user.punches and user.punches.length > 0
      Logger.addReaction 'clock4', res.message
      punch = null
      lastPunchDescription = user.lastPunch().description(user)
      user.undoPunch()
      .then(user.updateRow.bind(user))
      .then(
        () ->
          Logger.addReaction 'dog2', res.message
          Logger.removeReaction 'clock4', res.message
          user.directMessage "Undid your last punch, which was:
                              *#{lastPunchDescription}*\n\nYour most current
                              punch is now: *#{user.lastPunch().description(user)}*",
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
      user.directMessage 'There\'s nothing for me to undo.', Logger

  # User feedback

  robot.respond /hours (.*)/i, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t output hours, Organization isn\'t ready yet"
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      Logger.addReaction 'x', res.message
      return
    date = moment(res.match[1])
    if not date.isValid()
      Logger.log "hours: #{date} is an invalid date"
      user.directMessage "#{date} is not a valid date", Logger
      Logger.addReaction 'x', res.message
      return

    attachments = []
    report = null
    headers = HEADERS.payrollreports

    startOfDay = date.startOf('day')
    endOfDay = date.endOf('day')
    report = user.toRawPayroll(startOfDay, endOfDay)
    for punch in user.punches
      if punch.date.isBefore(startOfDay) or punch.date.isAfter(endOfDay)
        continue
      else
        attachments.push punch.slackAttachment()

    loggedAny = false
    if not report[headers.logged] and
       not report[headers.vacation] and
       not report[headers.sick] and
       not report[headers.unpaid]
      msg = "You haven\'t recorded any hours on #{date}."
    else
      if not report[headers.logged]
        msg = "You haven\'t recorded any paid work time"
      else
        msg = "You have *#{toTimeStr(report[headers.logged])} of paid work time*"
        loggedAny = true
      for kind in ['vacation', 'sick', 'unpaid']
        header = headers[kind]
        if kind is 'unpaid'
          kind = 'unpaid work'
        if report[header]
          if not loggedAny
            msg += ", but you have *#{toTimeStr(report[header])} of #{kind} time*"
            loggedAny = true
          else
            msg += " and *#{toTimeStr(report[header])} of #{kind} time*"
      msg += " recorded for #{date}."
    if report.extra?.projects and report.extra?.projects?.length > 0
      msg += ' ('
      for project in report.extra.projects
        msg += "##{project.name}"
      msg += ')'

    Logger.addReaction 'dog2', res.message
    user.directMessage msg, Logger, attachments


  robot.respond /(status|info)/i, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t output hours, Organization isn\'t ready yet"
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      Logger.addReaction 'x', res.message
      return

    user.directMessage "Your status:", Logger, [user.slackAttachment()]
    Logger.addReaction 'dog2', res.message


  robot.respond /(hours|today|week|month|year)+[\?\!\.¿¡]/i, (res) ->
    if not Organization.ready()
      Logger.log "Don\'t output hours, Organization isn\'t ready yet"
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      res.reply "Either you aren't part of the
                 Employee worksheet, something has gone
                 horribly wrong, or you aren\'t an employee
                 at #{Organization.name}."
      Logger.addReaction 'x', res.message
      return

    attachments = []
    mode = res.match[1]
    report = dateArticle = null
    headers = HEADERS.payrollreports
    if mode is 'week'
      sunday = moment({hour: 0, minute: 0, second: 0}).day("Sunday")
      now = moment({hour: 0, minute: 0, second: 0}).add(1, 'days')
      report = user.toRawPayroll(sunday, now)
      dateArticle = "this week"
      for punch in user.punches
        if punch.date.isBefore(sunday) or punch.date.isAfter(now)
          continue
        else if not punch.elapsed and not punch.times.block
          continue
        else if not punch.mode is 'out'
          continue
        else
          attachments.push punch.slackAttachment()
    else if mode is 'month'
      sunday = moment({hour: 0, minute: 0, second: 0}).startOf("month")
      now = moment({hour: 0, minute: 0, second: 0}).add(1, 'days')
      report = user.toRawPayroll(sunday, now)
      dateArticle = "this month"
    else if mode is 'year'
      sunday = moment({hour: 0, minute: 0, second: 0}).startOf("year")
      now = moment({hour: 0, minute: 0, second: 0}).add(1, 'days')
      report = user.toRawPayroll(sunday, now)
      dateArticle = "this year"
    else
      earlyToday = moment({hour: 0, minute: 0, second: 0})
      now = moment({hour: 0, minute: 0, second: 0}).add(1, 'days')
      report = user.toRawPayroll(earlyToday, now)
      dateArticle = "today"
      for punch in user.punches
        if punch.date.isBefore(earlyToday) or punch.date.isAfter(now)
          continue
        else
          attachments.push punch.slackAttachment()

    loggedAny = false
    if not report[headers.logged] and
       not report[headers.vacation] and
       not report[headers.sick] and
       not report[headers.unpaid]
      msg = "You haven\'t recorded any hours #{dateArticle}."
    else
      if not report[headers.logged]
        msg = "You haven\'t recorded any paid work time"
      else
        msg = "You have *#{toTimeStr(report[headers.logged])} of paid work time*"
        loggedAny = true
      for kind in ['vacation', 'sick', 'unpaid']
        header = headers[kind]
        if kind is 'unpaid'
          kind = 'unpaid work'
        if report[header]
          if not loggedAny
            msg += ", but you have *#{toTimeStr(report[header])} of #{kind} time*"
            loggedAny = true
          else
            msg += " and *#{toTimeStr(report[header])} of #{kind} time*"
      msg += " recorded for #{dateArticle}."
    if report.extra?.projects and report.extra?.projects?.length > 0
      msg += ' ('
      for project in report.extra.projects
        msg += "##{project.name}"
      msg += ')'

    Logger.addReaction 'dog2', res.message
    user.directMessage msg, Logger, attachments
