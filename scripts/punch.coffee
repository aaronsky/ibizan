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

  MODES = ['in', 'out', 'vacation', 'unpaid', 'sick']
  {HEADERS, REGEX} = require './src/constants'
  Organization = require('./src/organization').get()

  canPunchHere = (name, channel) ->
    try
      Organization.clockChannel is channel or name is channel
    catch e
      false

  splitFirstWord = (str) ->
    comps = str.split ' '
    [comps.shift(), comps.join ' ']

  parse = (res, msg, mode) ->
    if canPunchHere res.message.user.name, res.message.user.room
      # code
      punch = 
        mode: 'none'
        times: []
        projects: []
        notes: ''

      user = Organization.getUserBySlackName res.message.user.name
      if not user
        res.send "You aren\'t an employee at #{Organization.name}"
        return
      punch.user = user
      msg = res.match.input
      msg = msg.replace 'ibizan ', ''
      
      if not mode
        [punch.mode, msg] = parseMode msg

      [times, msg] = parseTime msg, user
      [dates, msg] = parseDate msg, user

      console.log dates
      console.log times

      for date in dates
        for time in times
          datetime = new Date(date)
          datetime.setHours(time.getHours())
          datetime.setMinutes(time.getMinutes())
          datetime.setSeconds(time.getSeconds())
          #console.log datetime
          punch.times.push datetime

      [punch.projects, msg] = parseProjects msg
      
      punch.notes = msg

      response = finalizePunch punch
      console.log response
      res.send response
    else
      res.send "Talk to me in private about this, please? ;)"

  parseMode = (msg) ->
    [mode, msg] = splitFirstWord msg
    mode = (mode || '').trim()
    msg = (msg || '').trim()
    if mode in MODES
      [mode, msg]
    else
      ['none', msg]

  parseTime = (msg, user) ->
    # parse time component
    msg = msg || ''
    time = []
    if match = msg.match REGEX.rel_time
      if match[0] is 'half-day' or match[0] is 'half day'
        copy = new Date(user.timetable.start.getTime())
        copy.setHours(user.timetable.start.getHours() - 4)
        time.push copy, user.timetable.end
      else
        length = match[3]
        # do something with the length
        # block.start = 
        # block.end = 
      msg = msg.replace(match[0] + ' ', '')
    # just 24 time, need support for 12 time
    else if match = msg.match REGEX.time
      # TODO: DRY
      # do something with the absolutism
      today = new Date()
      today_str = "#{today.getFullYear()}-#{today.getMonth()}-#{today.getDate()} "
      time.push new Date(today_str + match[0])
      msg = msg.replace(match[0] + ' ', '')
    # else if match = msg.match regex for time ranges (???)
    else
      time.push new Date()
    [time, msg]

  parseDate = (msg, user) ->
    msg = msg || ''
    date = []
    if match = msg.match /today/i
      date.push new Date()
      msg = msg.replace(match[0] + ' ', '')
    else if match = msg.match /yesterday/i
      today = new Date()
      today.setDate(today.getDate() - 1)
      date.push today
      msg = msg.replace(match[0] + ' ', '')
      [date, msg]
    else if match = msg.match REGEX.date # Placeholder for date blocks
      absDate = new Date(match[0])
      absDate.setFullYear(new Date().getFullYear())
      date.push absDate
      msg = msg.replace(match[0] + ' ', '')
    else
      date.push new Date()
    [date, msg]

  parseProjects = (msg) ->
    projects = []
    msg = msg || ''
    msg_copy = msg.split(' ').slice()
    for word in msg_copy
      if word.charAt(0) is '#'
        if project = Organization.getProjectByName word
          projects.push project
        msg = msg.replace word + ' ', ''
      else
        break
    [projects, msg]

  finalizePunch = (punch) ->
    Organization.spreadsheet.enterPunch punch
    JSON.stringify punch

  # respond to mode
  robot.respond /(in|out|vacation|sick|unpaid)/i, (res) ->
    parse res, res.match.input

  # respond to simple time block
  robot.respond /([0-9]+\.+[0-9]*) hours/i, (res) ->
    parse res, res.match.input, 'none'

