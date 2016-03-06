
moment = require 'moment-timezone'
weekend = require 'moment-weekend'
uuid = require 'node-uuid'

constants = require '../helpers/constants'
HEADERS = constants.HEADERS
REGEX = constants.REGEX
MODES = ['in', 'out', 'vacation', 'unpaid', 'sick']
Organization = require('../models/organization').get()

class Punch
  constructor: (@mode = 'none',
                @times = [],
                @projects = [],
                @notes = '') ->
    # ...

  @parse: (user, command, mode='none') ->
    if not user or not command
      return
    if mode and mode isnt 'none'
      [mode, command] = _parseMode command

    [start, end] = user.activeHours()
    [times, command] = _parseTime command, start, end
    [dates, command] = _parseDate command

    datetimes = []
    if dates.length is 0 and times.length is 0
      datetimes.push(moment())
    else if dates.length > 0 and times.length is 0
      datetimes.push(_mergeDateTime(dates[0], start))
      datetimes.push(_mergeDateTime(dates[dates.length - 1], end))
    else if dates.length is 0 and times.length > 0
      for time in times
        datetimes.push(_mergeDateTime(moment(), time))
    else
      if dates.length is 2 and times.length is 2
        datetimes.push(_mergeDateTime(dates[0], times[0]))
        datetimes.push(_mergeDateTime(dates[1], times[1]))
      else if dates.length is 2 and times.length is 1
        datetimes.push(_mergeDateTime(dates[0], times[0]))
        datetimes.push(_mergeDateTime(dates[1], times[0]))
      else if dates.length is 1 and times.length is 2
        datetimes.push(_mergeDateTime(dates[0], times[0]))
        datetimes.push(_mergeDateTime(dates[0], times[1]))
      else
        datetimes.push(_mergeDateTime(dates[0], times[0]))

    if times.block?
      datetimes.block = times.block
    else if datetimes.length is 2
      elapsed = datetimes[1].diff(datetimes[0], 'hours', true)
      if mode is 'vacation' or
         mode is 'sick'
        activeTime = user.activeTime()
        inactiveTime = +moment(start)
                        .add(1, 'days')
                        .diff(end, 'hours', true)
                        .toFixed(2)
        if dates.length is 2
          numDays = dates[1].diff(dates[0], 'days')

          holidays = 0
          currentDate = moment dates[0]
          while currentDate.isSameOrBefore dates[1]
            holiday_str = currentDate.holiday()
            if holiday_str?
              holidays += 1
            currentDate.add 1, 'days'

          numWorkdays = weekend.diff(dates[0], dates[1]) - holidays
          numWeekends = numDays - numWorkdays

        if elapsed > activeTime and
           numDays?
          for i in [1..numDays]
            elapsed -= inactiveTime
          if numWeekends > 0
            for i in [1..numWeekends]
              elapsed -= activeTime

    [projects, command] = _parseProjects command
    notes = command.trim()

    punch = new Punch(mode, datetimes, projects, notes)
    if elapsed
      punch.elapsed = elapsed
    punch
  
  @parseRaw: (row) ->
    if not row
      return
    if not row.save or row.del
      return
    headers = HEADERS.rawdata
    user = Organization.getUserByRealName row[headers.name]
    if not user
      return
    if row[headers.project1] is 'vacation' or
       row[headers.project1] is 'sick' or
       row[headers.project1] is 'unpaid'
      mode = row[headers.project1]
    else if row[headers.in] and not row[headers.out]
      mode = 'in'
    else if row[headers.out] and row[headers.elapsed]
      mode = 'out'
    else
      row = 'none'
    datetimes = []
    if row[headers.in]
      datetimes.push moment(row[headers.today] + ' ' + row[headers.in]).tz(user.timetable.timezone.name)
    if row[headers.out]
      datetimes.push moment(row[headers.today] + ' ' + row[headers.out]).tz(user.timetable.timezone.name)
    if row[headers.totalTime]
      comps = row[headers.totalTime].split ':'
      elapsed = parseInt(comps[0]) + (parseFloat(comps[1]) / 60)
    if row[headers.blockTime]
      comps = row[headers.blockTime].split ':'
      block = parseInt(comps[0]) + (parseFloat(comps[1]) / 60)
      datetimes.block = block
    projects = []
    for i in [1..6]
      projectStr = row[headers['project'+i]]
      if not projectStr
        break
      else if projectStr is 'vacation' or
         projectStr is 'sick' or
         projectStr is 'unpaid'
        break
      else if project = Organization.getProjectByName projectStr
        projects.push project
        continue
      else
        break
    notes = row[headers.notes]
    punch = new Punch(mode, datetimes, projects, notes)
    if elapsed
      punch.elapsed = elapsed
    punch
  out: (punch) ->
    if not @times.block?
      @times.push punch.times[0]
      @elapsed = @times[1].diff(@times[0], 'hours', true)

    extraProjectCount = @projects.length
    for project in punch.projects
      if extraProjectCount >= 6
        break
      if project not in @projects
        extraProjectCount += 1
        @projects.push project
    if punch.notes
      @notes = "#{@notes}\n#{punch.notes}"
    @mode = punch.mode

  toRawRow: (name) ->
    headers = HEADERS.rawdata
    row = @row || {}
    row[headers.id] = row[headers.id] || uuid.v1()
    row[headers.today] = row[headers.today] ||
                         moment.tz(constants.TIMEZONE).format('MM/DD/YYYY')
    row[headers.name] = row[headers.name] || name
    if @times.block?
      block = @times.block
      hours = Math.floor block
      minutes = Math.round((block - hours) * 60)
      minute_str = if minutes < 10 then "0#{minutes}" else minutes
      row[headers.blockTime] = "#{hours}:#{minute_str}:00"
    else
      for i in [0..1]
        if time = @times[i]
          row[headers[MODES[i]]] = time.tz(constants.TIMEZONE)
                                    .format('hh:mm:ss A')
        else
          row[headers[MODES[i]]] = ''
      if @elapsed
        hours = Math.floor @elapsed
        minutes = Math.round((@elapsed - hours) * 60)
        minute_str = if minutes < 10 then "0#{minutes}" else minutes
        row[headers.totalTime] = "#{hours}:#{minute_str}:00"
    row[headers.notes] = @notes
    if @mode is 'vacation' or
        @mode is 'sick' or
        @mode is 'unpaid'
      row[headers.project1] = @mode
    else
      max = if @projects.length < 6 then @projects.length else 5
      for i in [0..max]
        project = @projects[i]
        if project?
          row[headers["project#{i + 1}"]] = "##{project.name}"
    row

  assignRow: (row) ->
    if row? and
       row.save? and
       typeof row.save is 'function' and
       row.del? and
       typeof row.del is 'function'
      @row = row

  isValid: (user) ->
    # fail cases
    if @times.length is 2
      elapsed = @times[0].diff(@times[1], 'hours', true)
    else if @times[0]
      date = @times[0]
    if @mode is 'none' and not @times.block?
      return 'Malformed punch. Something has gone wrong.'
    else if @mode is 'in'
      # if mode is 'in' and user has not punched out
      if user.punches and
         user.punches.length > 0 and
         user.punches.slice(-1)[0].mode is 'in'
        return 'You haven\'t punched out yet.'
      else if @times
        yesterday = moment().subtract(1, 'days').startOf('day')
        for time in @times
          # if mode is 'in' and date is yesterday
          if time.isSame(yesterday, 'd')
            return 'You can\'t punch in for yesterday\'s date.'
    if @mode is 'out'
      if user.punches and
         user.punches.length > 0 and
         user.punches.slice(-1)[0].mode is 'out'
        return 'You cannot punch out before punching in.'
    # if mode is 'unpaid' and user is non-salary
    else if @mode is 'unpaid' and not user.salary
      return 'You aren\'t eligible to punch for unpaid time.'
    else if @mode is 'vacation' or
       @mode is 'sick' or
       @mode is 'unpaid'
      if user.punches and
         user.punches.length > 0 and
         user.punches.slice(-1)[0].mode is 'in'
        return 'You haven\'t punched out yet.'
      if elapsed
        # if mode is 'vacation' and user doesn't have enough vacation time
        if @mode is 'vacation' and
           user.timetable.vacationAvailable < elapsed
          return 'This punch exceeds your remaining vacation time.'
        # if mode is 'sick' and user doesn't have enough sick time
        else if @mode is 'sick' and
                user.timetable.sickAvailable < elapsed
          return 'This punch exceeds your remaining sick time.'
        # if mode is 'vacation' and time isn't divisible by 4
        # if mode is 'sick' and time isn't divisible by 4
        # if mode is 'unpaid' and time isn't divisible by 4
        else if elapsed % 4 isnt 0
          return 'This punch duration is not divisible by 4 hours.'
      else
        # a vacation/sick/unpaid punch must be a range
        return "A #{@mode} punch needs to either be a range or a block of time."
    # if date is more than 7 days from today
    else if date and moment().diff(date, 'days') >= 7
      return 'You cannot punch for a date older than 7 days.'
    return true

_mergeDateTime = (date, time) ->
  return moment({
    year: date.get('year'),
    month: date.get('month'),
    date: date.get('date'),
    hour: time.get('hour'),
    minute: time.get('minute'),
    second: time.get('second')
  })

_parseMode = (command) ->
  comps = command.split ' '
  [mode, command] = [comps.shift(), comps.join ' ']
  mode = (mode || '').trim()
  command = (command || '').trim()
  if mode in MODES
    [mode, command]
  else
    ['none', command]

_parseTime = (command, activeStart, activeEnd) ->
  # parse time component
  command = command.trimLeft() || ''
  time = []
  if match = command.match REGEX.rel_time
    if match[0] is 'half-day' or match[0] is 'half day'
      copy = moment(activeStart)
      copy.hour(activeStart.hour() - 4)
      time.push copy, activeEnd
    else if match[0] is 'noon'
      time.push moment({hour: 12, minute: 0})
    else if match[0] is 'midnight'
      time.push moment({hour: 0, minute: 0})
    else
      block = parseFloat match[3]
      time.block = block
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match REGEX.time
    timeMatch = match[0]
    today = moment()
    if hourStr = timeMatch.match /\b(([0-1][0-9])|(2[0-3])):/i
      hour = parseInt (hourStr[0].replace(':', ''))
      if hour <= 12
        isPM = today.format('a') is 'pm'
        if not timeMatch.match /am?|pm?/i
          timeMatch = timeMatch + " #{today.format('a')}"
    today = moment(timeMatch, 'h:mm a')
    if isPM
      today.add(12, 'hours')
    time.push today
    command = command.replace ///#{match[0]} ?///i, ''
  # else if match = command.match regex for time ranges (???)
  [time, command]

_parseDate = (command) ->
  command = command.trimLeft() || ''
  date = []
  if match = command.match /today/i
    date.push moment()
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match /yesterday/i
    yesterday = moment().subtract(1, 'days')
    date.push yesterday
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match REGEX.days
    today = moment()
    if today.format('dddd').toLowerCase() isnt match[0]
      today = today.day(match[0]).subtract(7, 'days')
    date.push today
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match REGEX.date # Placeholder for date blocks
    if match[0].indexOf('-') isnt -1
      dateStrings = match[0].split('-')
      month = ''
      for str in dateStrings
        str = str.trim()
        if not isNaN(str) and month?
          str = month + ' ' + str
        newDate = moment(str, "MMMM DD")
        month = newDate.format('MMMM')
        date.push newDate
    else
      absDate = moment(match[0], "MMMM DD")
      date.push absDate
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match REGEX.numdate
    if match[0].indexOf('-') isnt -1
      dateStrings = match[0].split('-')
      month = ''
      for str in dateStrings
        str = str.trim()
        date.push moment(str, 'MM/DD')
    else
      absDate = moment(match[0], 'MM/DD')
      date.push absDate
    command = command.replace ///#{match[0]} ?///i, ''
  [date, command]

_parseProjects = (command) ->
  projects = []
  command = command.trimLeft() || ''
  command_copy = command.split(' ').slice()

  for word in command_copy
    if word.charAt(0) is '#'
      if project = Organization.getProjectByName word
        projects.push project
      command = command.replace ///#{word} ?///i, ''
    else
      break
  [projects, command]

module.exports = Punch
