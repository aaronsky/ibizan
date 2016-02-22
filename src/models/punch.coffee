
moment = require 'moment'
uuid = require 'node-uuid'

{ HEADERS, REGEX } = require '../helpers/constants'
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
    if times.length > 0 and dates.length > 0
      for date in dates
        for time in times
          datetime = _mergeDateTime(date, time)
          datetimes.push datetime
    else if dates.length > 0 and times.length is 0
      for date in dates
        datetime = _mergeDateTime(date, moment())
        datetimes.push datetime
    else if times.length > 0 and dates.length is 0
      for time in times
        datetime = _mergeDateTime(moment(), time)
        datetimes.push datetimes
    else
      datetimes.push moment()

    if times.block?
      datetimes.block = times.block

    [projects, command] = _parseProjects command
    notes = command.trim()

    punch = new Punch(mode, datetimes, projects, notes)
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
        @projects.push = project.name
    if punch.notes
      @notes = "#{@notes}\n#{punch.notes}"

  toRawRow: (name) ->
    headers = HEADERS.rawdata
    row = @row || {}
    row[headers.id] = row[headers.id] || uuid.v1()
    row[headers.today] = row[headers.today] || moment().format('MM/DD/YYYY')
    row[headers.name] = row[headers.name] || name
    if @times.block?
      block = @times.block
      hours = Math.floor block
      minutes = Math.round((block - hours) * 60)
      row[headers.blockTime] = "#{hours}:#{if minutes < 10 then "0#{minutes}" else minutes}:00"
    else
      for time, i in @times
        row[headers[MODES[i]]] = time.format('hh:mm:ss A')
      if @elapsed
        hours = Math.floor @elapsed
        minutes = Math.round((@elapsed - hours) * 60)
        row[headers.totalTime] = "#{hours}:#{if minutes < 10 then "0#{minutes}" else minutes}:00"
    row[headers.notes] = @notes
    max = if @projects.length < 6 then @projects.length else 5
    for i in [0..max]
      project = @projects[i]
      if project?
        row[headers["project#{i + 1}"]] = "##{project.name}"
    row

  assignRow: (row) ->
    @row = row

  isValid: (user) ->
    # fail cases
    if @times.length is 2
      elapsed = @times[0].diff(@times[1], 'hours', true)
    else if @times[0]
      date = @times[0]
    if @mode is 'in'
      # if mode is 'in' and user has not punched out
      if user.lastPunch
        return false
      else if @times
        yesterday = moment().subtract(1, 'days').startOf('day')
        for time in @times
          # if mode is 'in' and date is yesterday
          if time.isSame(yesterday, 'd')
            return false
    # if mode is 'unpaid' and user is non-salary
    else if @mode is 'unpaid' and not user.salary
      return false
    else if @mode is 'vacation' or @mode is 'sick' or @mode is 'unpaid'
      if elapsed
        # if mode is 'vacation' and user doesn't have enough vacation time
        if @mode is 'vacation' and
           user.timetable.vacationAvailable < elapsed
          return false
        # if mode is 'sick' and user doesn't have enough sick time
        else if @mode is 'sick' and
                user.timetable.sickAvailable < elapsed
          return false
        # if mode is 'vacation' and time isn't divisible by 4
        # if mode is 'sick' and time isn't divisible by 4
        # if mode is 'unpaid' and time isn't divisible by 4
        else if elapsed % 4 isnt 0
          return false
    # if date is more than 7 days from today
    else if date and moment().diff(date, 'days') >= 7
      return false
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
        date.push moment(str, "MMMM DD")
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