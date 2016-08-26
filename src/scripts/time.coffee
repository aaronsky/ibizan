# Description:
#   Punch your timesheet from the comfort of Slack
#
# Commands:
#   ibizan in - Punch in at the current time and date
#   ibizan out - Punch out at the current time and date
#   ibizan in #project1 - Punch in at the current time and assigns the current
#                         project to #project1
#   ibizan out #project1 #project2 - Punch out at the current time and splits
#                                    the worked time since last in-punch between
#                                    #project1 and #project2
#   ibizan in 9:15 - Punch in at 9:15am today
#   ibizan out 7pm yesterday - Punch out yesterday at 7pm
#   ibizan in 17:00 #project3 - Punch in at 5pm and assigns the time until next
#                               out-punch to #project3
#   ibizan 1.5 hours - Append 1.5 hours to today's total time
#   ibizan 2 hours yesterday - Append 2 hours on to yesterday's total time
#   ibizan 3.25 hours tuesday #project1 - Append 3.25 hours on to Tuesday's
#                                         total time and assigns it to #project1
#   ibizan vacation today - Flags the user’s entire day as vacation time
#   ibizan sick half-day - Flags half the user’s day as sick time
#   ibizan vacation half-day yesterday - Flags half the user’s previous day
#                                        (4 hours) as vacation time
#   ibizan sick Jul 6-8 - Flags July 6-8 of this year as sick time
#   ibizan vacation 1/28 - 2/4 - Flags January 28th to February 4th of this year
#                                as vacation time.
#
#   ibizan hours - Replies with helpful info for hours? and hours [date]
#   ibizan hours 8/4 - Replies with punches recorded on a given date
#   ibizan hours? - Replies with the user's total time for today, with punches
#   ibizan today? - Replies with the user's total time for today, with punches
#   ibizan week? - Replies with the user's total time for the week, with punches
#   ibizan month? - Replies with the user's total time for the month
#   ibizan year? - Replies with the user's total time for the year
#   ibizan status - Replies with the user's Employee sheet info
#   ibizan time - Replies with the current time in both Ibizan's default
#                 timezone and the user's timezone
#   ibizan timezone - Replies with the user's timezone
#   ibizan timezone america/chicago - Sets the user's timezone
#
# Notes:
#   All dates are formatted in MM/DD notation with no support for overriding
#   year. Ibizan will extrapolate year from your ranges, even if it stretches
#   over multiple years.
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

  # Parse a textual punch and product a new Punch object
  parse = (res, msg, mode) ->
    mode = mode.toLowerCase()
    user = Organization.getUserBySlackName res.message.user.name
    Logger.log "Parsing '#{msg}' for @#{user.slack}."
    if canPunchHere res.message.room
      Logger.addReaction 'clock4', res.message
      msg = res.match.input
      msg = msg.replace REGEX.ibizan, ''
      msg = msg.trim()
      tz = user.timetable.timezone.name or TIMEZONE
      punch = Punch.parse user, msg, mode, tz
      if not punch.projects.length and
         isProjectChannel res.message.room
        project = Organization.getProjectByName res.message.room
        if project?
          punch.projects.push project

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
      Logger.addReaction 'x', res.message
      user.directMessage "You cannot punch in ##{channelName}.
                          Try punching in ##{Organization.clockChannel},
                          a designated project channel, or here.",
                         Logger

  # Send the punch to the Organization's Spreadsheet
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
        Logger.log "@#{user.slack}'s punch was successfully entered
                    into the spreadsheet."
        punchEnglish = "Punched you *#{punch.description(user)}*."

        if punch.mode is 'in'
          user.directMessage punchEnglish, Logger
        else
          user.directMessage punchEnglish, Logger, [punch.slackAttachment()]
        Logger.addReaction 'dog2', res.message
        Logger.removeReaction 'clock4', res.message
    )
    .catch(
      (err) ->
        errorMsg = Logger.clean err
        Logger.error errorMsg
        Logger.errorToSlack "\"#{errorMsg}\" was returned for
                             #{user.slack}. Punch:\n", res.match.input
        user.directMessage "\n#{errorMsg}",
                           Logger
        Logger.addReaction 'x', res.message
        Logger.removeReaction 'clock4', res.message
    )
    .done()

  # Punch for a given mode
  robot.respond REGEX.modes, id: 'time.punchByMode', userRequired: true, (res) ->
    parse res, res.match.input, res.match[1]

  # Punch for a block of time
  robot.respond REGEX.rel_time, id: 'time.punchByTime', userRequired: true, (res) ->
    parse res, res.match.input, 'none'

  # Append to lastPunch
  robot.respond /(append|add)/i, id: 'time.append', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name

    msg = res.match.input
    msg = msg.replace REGEX.ibizan, ''
    msg = msg.replace /(append|add)/i, ''
    msg = msg.trim()

    words = msg.split ' '
    op = words[0]
    words.shift()
    msg = words.join(' ').trim()
    results = ''
    
    if op is 'project' or
       op is 'projects' or
       op is 'note' or
       op is 'notes'
      punch = user.lastPunch 'in'
      if not punch
        user.directMessage strings.notpunchedin,
                           Logger
        return
      if op is 'project' or
         op is 'projects'
        projects = msg.split ' '
        if projects.length is 0 and
           isProjectChannel res.message.user.room
          projects.push Organization.getProjectByName(res.message.user.room)
        punch.appendProjects projects
        results = projects?.join(', ') ? ''
      else if op is 'note' or
              op is 'notes'
        punch.appendNotes msg
        results = "'#{msg}'"
      row = punch.toRawRow user.name
      Organization.spreadsheet.saveRow(row)
      .catch(
        (err) ->
          user.directMessage err, Logger
          Logger.error 'Unable to append row', new Error(err)
      ).done(
        user.directMessage "Added #{op} #{results}",
                           Logger
        Logger.addReaction 'dog2', res.message
      )
    else if op is 'event' or
            op is 'calendar' or
            op is 'upcoming'
      Logger.addReaction 'clock4', res.message
      date = moment(words[0], 'MM/DD/YYYY')
      if not date.isValid()
        Logger.addReaction 'x', res.message
        Logger.removeReaction 'clock4', res.message
        res.reply "Your event has an invalid date. Make sure you're using the
                   proper syntax, e.g. `ibizan add event 3/21 Dog Time`"
        return
      words.shift()
      name = words.join(' ').trim()
      if not name or not name.length > 0
        Logger.addReaction 'x', res.message
        Logger.removeReaction 'clock4', res.message
        res.reply "Your event needs a name. Make sure you're using the
                   proper syntax, e.g. `ibizan add event 3/21 Dog Time`"
        return
      Logger.debug "Adding event on #{date} named #{name}"
      Organization.addEvent(date, name)
      .then(
        (calendarevent) ->
          Logger.addReaction 'dog2', res.message
          Logger.removeReaction 'clock4', res.message
          res.reply "Added new event: *#{calendarevent.name}* on
                     *#{calendarevent.date.format('M/DD/YYYY')}*"
      )
      .catch(
        (err) ->
          Logger.error err
          Logger.addReaction 'x', res.message
          Logger.removeReaction 'clock4', res.message
          res.reply "Something went wrong when adding your event."
      )
      .done()
    else
      user.directMessage "I could not understand what you are trying to add.
                          Things you could `add` include:\n
                          `add note [note]` - Append a note to your current
                          punch\n
                          `add project [#project]` - Append a project to your
                          current punch\n
                          `add event [date] [name]` - Add a new event to the
                          calendar",
                         Logger

  robot.respond /\bundo$/i, id: 'time.undo', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
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
                              punch is now:
                              *#{user.lastPunch().description(user)}*",
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

  robot.respond /\b(events|upcoming)$/i, id: 'time.events', (res) ->
    response = ""
    upcomingEvents = Organization.calendar.upcomingEvents()
    if upcomingEvents.length > 0
      response += "Upcoming events:\n"
      for calendarevent in upcomingEvents
        response += "*#{calendarevent.date.format('M/DD/YY')}* - #{calendarevent.name}\n"
    else
      response = "There are no upcoming events on the calendar."
    res.send response
    Logger.addReaction 'dog2', res.message


  ## User feedback ##

  # Gives helpful info if a user types 'hours' with no question mark or date
  robot.respond /\bhours$/i, id: 'time.hoursHelp', (res) ->
    res.send strings.hourshelp
    Logger.addReaction 'dog2', res.message

  # Returns the hours worked on a given date
  robot.respond /hours (.*)/i, id: 'time.hoursOnDate', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    tz = user.timetable.timezone.name
    date = moment(res.match[1], "MM/DD/YYYY")
    if not date.isValid()
      Logger.log "hours: #{res.match[1]} is an invalid date"
      user.directMessage "#{res.match[1]} is not a valid date", Logger
      Logger.addReaction 'x', res.message
      return
    formattedDate = date.format('dddd, MMMM D, YYYY')

    attachments = []
    report = null
    headers = HEADERS.payrollreports

    startOfDay = moment.tz(date, tz).startOf('day')
    endOfDay = moment.tz(date, tz).endOf('day')
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
      msg = "You haven't recorded any hours on #{formattedDate}."
    else
      if not report[headers.logged]
        msg = "You haven't recorded any paid work time"
      else
        msg = "You have *#{toTimeStr(report[headers.logged])} of
               paid work time*"
        loggedAny = true
      for kind in ['vacation', 'sick', 'unpaid']
        header = headers[kind]
        if kind is 'unpaid'
          kind = 'unpaid work'
        if report[header]
          if not loggedAny
            msg += ", but you have *#{toTimeStr(report[header])} of
                    #{kind} time*"
            loggedAny = true
          else
            msg += " and *#{toTimeStr(report[header])} of #{kind} time*"
      msg += " recorded for #{formattedDate}."
    if report.extra?.projects and report.extra?.projects?.length > 0
      msg += ' ('
      for project in report.extra.projects
        msg += "##{project.name}"
      msg += ')'

    Logger.addReaction 'dog2', res.message
    user.directMessage msg, Logger, attachments

  # Returns the hours worked for the given time period
  robot.respond /.*(hours|today|week|month|year|period)+[\?\!\.¿¡]/i, id: 'time.hours', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    tz = user.timetable.timezone.name
    now = moment.tz(tz)
    attachments = []
    mode = res.match[1].toLowerCase()
    report = dateArticle = null
    headers = HEADERS.payrollreports
    if mode is 'week'
      sunday = moment({hour: 0, minute: 0, second: 0}).day("Sunday")
      report = user.toRawPayroll(sunday, now)
      dateArticle = "this week"
      for punch in user.punches
        if punch.date.isBefore(sunday) or punch.date.isAfter(now)
          continue
        else if not punch.elapsed and not punch.times.block
          continue
        else
          attachments.push punch.slackAttachment()
    else if mode is 'month'
      startOfMonth =
        moment.tz({hour: 0, minute: 0, second: 0}, tz).startOf("month")
      report = user.toRawPayroll(startOfMonth, now)
      dateArticle = "this month"
    else if mode is 'year'
      startOfYear =
        moment.tz({hour: 0, minute: 0, second: 0}, tz).startOf("year")
      report = user.toRawPayroll(startOfYear, now)
      dateArticle = "this year"
    else if mode is 'period'
      periodStart = moment({hour: 0, minute: 0, second: 0}).day("Sunday")
      if Organization.calendar.isPayWeek()
        periodStart = periodStart.subtract(1, 'weeks')
      periodEnd = periodStart.clone().add(2, 'weeks')
      if res.match[0].match(/(last|previous)/)
        periodStart = periodStart.subtract(2, 'weeks')
        periodEnd = periodEnd.subtract(2, 'weeks')
        dateArticle = "last pay period (#{periodStart.format('M/DD')} to
                       #{periodEnd.format('M/DD')})"
      else
        dateArticle = "this pay period (#{periodStart.format('M/DD')} to
                       #{periodEnd.format('M/DD')})"
      report = user.toRawPayroll(periodStart, periodEnd)
      for punch in user.punches
        if punch.date.isBefore(periodStart) or punch.date.isAfter(periodEnd)
          continue
        else if not punch.elapsed and not punch.times.block
          continue
        else
          attachments.push punch.slackAttachment()
    else
      earlyToday =
        now.clone().hour(0).minute(0).second(0).subtract(1, 'minutes')
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
      msg = "You haven't recorded any hours #{dateArticle}."
    else
      if not report[headers.logged]
        msg = "You haven't recorded any paid work time"
      else
        msg = "You have *#{toTimeStr(report[headers.logged])} of
               paid work time*"
        loggedAny = true
      for kind in ['vacation', 'sick', 'unpaid']
        header = headers[kind]
        if kind is 'unpaid'
          kind = 'unpaid work'
        if report[header]
          if not loggedAny
            msg += ", but you have *#{toTimeStr(report[header])} of
                    #{kind} time*"
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

  # Returns the user's info as a slackAttachment
  robot.respond /\b(status|info)$/i, id: 'time.status', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    user.directMessage "Your status:", Logger, [user.slackAttachment()]
    Logger.addReaction 'dog2', res.message

  # Returns the user's time in their timezone, as well as Ibizan's default time
  robot.respond /\btime$/i, id: 'time.time', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    userTime = moment.tz(user.timetable.timezone.name)
    ibizanTime = moment.tz(TIMEZONE)
    msg = "It's currently *#{userTime.format('h:mm A')}* in your timezone
           (#{userTime.format('z, Z')})."
    if userTime.format('z') != ibizanTime.format('z')
      msg += "\n\nIt's #{ibizanTime.format('h:mm A')} in the default timezone
              (#{ibizanTime.format('z, Z')})."
    user.directMessage msg, Logger
    Logger.addReaction 'dog2', res.message

  # Returns the user's timezone
  robot.respond /\btimezone$/i, id: 'time.time', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    userTime = moment.tz(user.timetable.timezone.name)
    user.directMessage "Your timezone is set to
                        *#{user.timetable.timezone.name}*
                        (#{userTime.format('z, Z')}).",
                       Logger
    Logger.addReaction 'dog2', res.message

  # Sets the user's timezone
  robot.respond /timezone (.*)/i, id: 'time.time', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    input = res.match[1]
    tzset = false

    tz = user.setTimezone(input)
    if tz
      tzset = true
    else
      # Try adding 'America/' if a region is not specified
      if input.indexOf("/") < 0
        input = "America/" + input
      if tz = user.setTimezone(input)
        tzset = true
      else
        # Try changing spaces to underscores
        input = input.replace ' ', '_'
        if tz = user.setTimezone(input)
          tzset = true

    if tzset
      userTime = moment.tz(user.timetable.timezone.name)
      user.directMessage "Your timezone is now
                          *#{user.timetable.timezone.name}*
                          (#{userTime.format('z, Z')}).",
                         Logger
      Logger.addReaction 'dog2', res.message
    else
      user.directMessage "I do not recognize that timezone.
                          Check <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List|this list>
                          for a valid time zone name.",
                         Logger
      Logger.addReaction 'x', res.message

  # Sets the user's active times
  robot.respond /active\s*(.*)?$/i, id: 'time.active', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name
    command = res.match[1]
    if not command
      res.send strings.activehelp
      Logger.addReaction 'dog2', res.message
      return
    comps = command.split(' ') || []
    scope = comps[0] || 'unknown'
    time = comps[1] || 'notime'

    if scope isnt 'unknown' and time isnt 'notime'
      newtime = moment.tz(time, 'h:mm A', user.timetable.timezone.name)
      if not newtime.isValid()
        user.directMessage "#{time} is not a valid time.", Logger
        Logger.addReaction 'x', res.message
        return
      if scope is 'start'
        if not newtime.isBefore(user.timetable.end)
          user.directMessage "#{newtime.format('h:mm A')} is not before your
                              current end time of
                              #{user.timetable.start.format('h:mm A')}.",
                             Logger
          Logger.addReaction 'x', res.message
          return
        else
          user.setStart newtime
      else if scope is 'end'
        if not newtime.isAfter(user.timetable.start)
          user.directMessage "#{newtime.format('h:mm A')} is not after your
                              current start time of
                              #{user.timetable.start.format('h:mm A')}.",
                             Logger
          Logger.addReaction 'x', res.message
          return
        else
          user.setEnd newtime
      user.directMessage "Your active *#{scope}* time is now
                          *#{newtime.format('h:mm A')}*.",
                         Logger
      Logger.addReaction 'dog2', res.message
    else
      user.directMessage strings.activefail, Logger
      Logger.addReaction 'x', res.message
