
moment = require 'moment-timezone'
weekend = require 'moment-weekend'
uuid = require 'node-uuid'

{ HEADERS, REGEX, TIMEZONE } = require '../helpers/constants'
Logger = require('../helpers/logger')()
MODES = ['in', 'out', 'vacation', 'unpaid', 'sick']
Organization = require('./organization').get()

class Punch
  constructor: (@mode = 'none',
                @times = [],
                @projects = [],
                @notes = '') ->
    # ...

  @parse: (user, command, mode='none', timezone) ->
    if not user
      Logger.error 'No user passed', new Error(command)
      return
    else if not command
      Logger.error 'No command passed', new Error(user)
      return
    if mode and mode isnt 'none'
      [mode, command] = _parseMode command

    original = command.slice 0

    [start, end] = user.activeHours()
    [times, command] = _parseTime command, start, end
    [dates, command] = _parseDate command

    tz = timezone || user.timetable.timezone.name
    datetimes = []
    if dates.length is 0 and times.length is 0
      datetimes.push(moment.tz(tz))
    else if dates.length > 0 and times.length is 0
      datetimes.push(_mergeDateTime(dates[0], start, tz))
      datetimes.push(_mergeDateTime(dates[dates.length - 1], end, tz))
    else if dates.length is 0 and times.length > 0
      for time in times
        datetimes.push(_mergeDateTime(moment.tz(tz), time, tz))
    else
      if dates.length is 2 and times.length is 2
        datetimes.push(_mergeDateTime(dates[0], times[0], tz))
        datetimes.push(_mergeDateTime(dates[1], times[1], tz))
      else if dates.length is 2 and times.length is 1
        datetimes.push(_mergeDateTime(dates[0], times[0], tz))
        datetimes.push(_mergeDateTime(dates[1], times[0], tz))
      else if dates.length is 1 and times.length is 2
        datetimes.push(_mergeDateTime(dates[0], times[0], tz))
        datetimes.push(_mergeDateTime(dates[0], times[1], tz))
      else
        datetimes.push(_mergeDateTime(dates[0], times[0], tz))

    if times.block?
      datetimes.block = times.block
      if datetimes[0]
        date = moment.tz(datetimes[0], tz)
      while datetimes.length isnt 0
        datetimes.pop()
      if mode is 'in'
        mode = 'none'
    else if datetimes.length is 2
      if mode is 'out'
        Logger.error 'Out punch cannot be range', new Error(original)
        return
      else
        if datetimes[1].isBefore datetimes[0]
          datetimes[1] = datetimes[1].add(1, 'days')
        elapsed = _calculateElapsed datetimes[0], datetimes[1], mode, user
        if mode is 'in'
          mode = 'none'

    [projects, command] = _parseProjects command
    notes = command.trim()

    punch = new Punch(mode, datetimes, projects, notes)
    punch.date = datetimes[0] || date || moment.tz(tz)
    punch.timezone = tz
    if elapsed
      punch.elapsed = elapsed
    punch
  
  @parseRaw: (user, row, projects = []) ->
    if not user
      return
    else if not row
      return
    else if not row.save or not row.del
      return
    headers = HEADERS.rawdata
    date = moment.tz(row[headers.today], 'MM/DD/YYYY', TIMEZONE)
    if row[headers.project1] is 'vacation' or
       row[headers.project1] is 'sick' or
       row[headers.project1] is 'unpaid'
      mode = row[headers.project1]
    else if row[headers.in] and not row[headers.out]
      mode = 'in'
    else if row[headers.out] and row[headers.totalTime]
      mode = 'out'
    else
      mode = 'none'
    datetimes = []
    tz = user.timetable.timezone.name
    for i in [0..1]
      if row[headers[MODES[i]]]
        newDate = moment.tz(row[headers[MODES[i]]],
                            'MM/DD/YYYY hh:mm:ss a',
                            TIMEZONE)
        if not newDate or
           not newDate.isValid()
          timePiece = moment.tz(row[headers[MODES[i]]],
                                'hh:mm:ss a',
                                TIMEZONE)
          newDate = moment.tz("#{row[headers.today]} #{row[headers[MODES[i]]]}",
                              'MM/DD/YYYY hh:mm:ss a',
                              TIMEZONE)
        datetimes.push newDate.tz(tz)
    if row[headers.totalTime]
      comps = row[headers.totalTime].split ':'
      rawElapsed = 0
      for comp, i in comps
        if isNaN comp
          continue
        else
          comp = parseInt comp
          rawElapsed += +(comp / Math.pow 60, i).toFixed(2)
    if row[headers.blockTime]
      comps = row[headers.blockTime].split ':'
      block = parseInt(comps[0]) + (parseFloat(comps[1]) / 60)
      datetimes.block = block
    else if datetimes.length is 2
      if datetimes[1].isBefore datetimes[0]
        datetimes[1].add(1, 'days')
      elapsed = _calculateElapsed datetimes[0], datetimes[1], mode, user
      if elapsed < 0
        Logger.error 'Invalid punch row: elapsed time is less than 0', new Error(datetimes)
        return
      else if elapsed isnt rawElapsed
        hours = Math.floor elapsed
        minutes = Math.round((elapsed - hours) * 60)
        minute_str = if minutes < 10 then "0#{minutes}" else minutes
        row[headers.totalTime] = "#{hours}:#{minute_str}:00.000"
        row.save (err) ->
          if err
            Logger.error err
    
    foundProjects = []
    for i in [1..6]
      projectStr = row[headers['project'+i]]
      if not projectStr
        break
      else if projectStr is 'vacation' or
         projectStr is 'sick' or
         projectStr is 'unpaid'
        break
      else
        if Organization.ready() and projects.length is 0
          project = Organization.getProjectByName projectStr
        else if projects.length > 0
          project = projects.filter((item, index, arr) ->
            return "##{item.name}" is projectStr or item.name is projectStr
          )[0]
        if project
          foundProjects.push project
          continue
        else
          break
    notes = row[headers.notes]
    punch = new Punch(mode, datetimes, foundProjects, notes)
    punch.date = date
    punch.timezone = tz
    if elapsed
      punch.elapsed = elapsed
    punch.assignRow row
    punch

  appendProjects: (projects = []) ->
    extraProjectCount = @projects.length
    if extraProjectCount >= 6
      return
    for project in projects
      if @projects.length > 6
        return
      if typeof project is 'string'
        if project.charAt(0) is '#'
          project = Organization.getProjectByName project
        else
          project = Organization.getProjectByName "##{project}"
      if not project
        continue
      else if project not in @projects
        @projects.push project
    return projects.join(' ')

  appendNotes: (notes = '') ->
    if @notes and @notes.length > 0
      @notes += '\n'
    @notes += notes

  out: (punch) ->
    if @mode is 'out'
      return
    if not @times.block? and
       @mode is 'in' and
       @times.length is 1
      if punch.times.block?
        newTime = moment.tz(@times[0], @timezone).add(punch.times.block, 'hours')
      else
        newTime = moment.tz(punch.times[0], punch.timezone)
        if newTime.isBefore @times[0]
          newTime.add(1, 'days')
      @elapsed = _calculateElapsed @times[0], newTime, 'out'
      @times.push newTime
    if punch.projects
      @appendProjects punch.projects
    if punch.notes
      @appendNotes punch.notes
    @mode = punch.mode

  toRawRow: (name) ->
    headers = HEADERS.rawdata
    today = moment.tz(TIMEZONE)
    row = @row || {}
    row[headers.id] = row[headers.id] || uuid.v1()
    row[headers.today] = row[headers.today] || @date.format('MM/DD/YYYY')
    row[headers.name] = row[headers.name] || name
    if @times.block?
      block = @times.block
      hours = Math.floor block
      minutes = Math.round((block - hours) * 60)
      minute_str = if minutes < 10 then "0#{minutes}" else minutes
      row[headers.blockTime] = "#{hours}:#{minute_str}:00.000"
    else
      for i in [0..1]
        if time = @times[i]
          row[headers[MODES[i]]] = time.tz(TIMEZONE).format('MM/DD/YYYY hh:mm:ss A')
        else
          row[headers[MODES[i]]] = ''
      if @elapsed
        hours = Math.floor @elapsed
        minutes = Math.round((@elapsed - hours) * 60)
        minute_str = if minutes < 10 then "0#{minutes}" else minutes
        row[headers.totalTime] = "#{hours}:#{minute_str}:00.000"
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
    if @times.block?
      elapsed = @times.block
    else if @elapsed?
      elapsed = @elapsed
    if @times.length is 2
      elapsed = @times[0].diff(@times[1], 'hours', true)
    else if @times[0]
      date = @times[0]
    if @mode is 'none' and not elapsed
      return 'Malformed punch. Something has gone wrong.'
    else if @mode is 'in'
      # if mode is 'in' and user has not punched out
      if last = user.lastPunch 'in'
        time = last.times[0].tz(user.timetable.timezone.name)
        return "You haven't punched out yet. Your last in-punch was at
                #{time.format('h:mma')} on #{time.format('dddd, MMMM Do')}."
      else if @times
        yesterday = moment().subtract(1, 'days').startOf('day')
        for time in @times
          # if mode is 'in' and date is yesterday
          if time.isSame(yesterday, 'd')
            return 'You can\'t punch in for yesterday\'s date.'
    else if @mode is 'out'
      if lastIn = user.lastPunch 'in'
        return true
      last = user.lastPunch 'out', 'vacation', 'unpaid', 'sick'
      time = last.times[0].tz(user.timetable.timezone.name)
      return "You cannot punch out before punching in. Your last
              out-punch was at #{time.format('h:mma')} on
              #{time.format('dddd, MMMM Do')}."
    # if mode is 'unpaid' and user is non-salary
    else if @mode is 'unpaid' and not user.salary
      return 'You aren\'t eligible to punch for unpaid time.'
    else if @mode is 'vacation' or
       @mode is 'sick' or
       @mode is 'unpaid'
      if last = user.lastPunch('in') and
         not @times.block?
        time = last.times[0].tz(user.timetable.timezone.name)
        return "You haven't punched out yet. Your last in-punch was at
                #{time.format('h:mma')} on #{time.format('dddd, MMMM Do')}."
      if elapsed
        # if mode is 'vacation' and user doesn't have enough vacation time
        elapsedDays = user.toDays(elapsed)
        if @mode is 'vacation' and
           user.timetable.vacationAvailable < elapsedDays
          return 'This punch exceeds your remaining vacation time.'
        # if mode is 'sick' and user doesn't have enough sick time
        else if @mode is 'sick' and
                user.timetable.sickAvailable < elapsedDays
          return 'This punch exceeds your remaining sick time.'
        # if mode is 'vacation' and time isn't divisible by 4
        # if mode is 'sick' and time isn't divisible by 4
        # if mode is 'unpaid' and time isn't divisible by 4
        # else if elapsed % 4 isnt 0
        #   return 'This punch duration is not divisible by 4 hours.'
      else
        # a vacation/sick/unpaid punch must be a range
        return "A #{@mode} punch needs to either be a range or a block of time."
    # if date is more than 7 days from today
    else if date and moment().diff(date, 'days') >= 7
      return 'You cannot punch for a date older than 7 days.'
    return true

  description: (user) ->
    modeQualifier =
     timeQualifier =
     elapsedQualifier =
     projectsQualifier =
     notesQualifier =
     warningQualifier = ''
    if @times.block?
      hours = Math.floor @times.block
      if hours is 0
        hoursStr = ''
      else
        hoursStr = "#{hours} hour"
      minutes = Math.round((@times.block - hours) * 60)
      if minutes is 0
        minutesStr = ''
      else
        minutesStr = "#{minutes} minute"
      blockTimeQualifier = "#{hoursStr}#{if minutes > 0 then ', ' else ''}#{minutesStr}"
      if blockTimeQualifier.charAt(0) is '8' or
         @times.block is 11 or
         @times.block is 18
        article = 'an'
      else
        article = 'a'
    else
      time = @times.slice(-1)[0]
      if time.isSame(moment(), 'day')
        dateQualifier = "today"
      else if time.isSame(moment().subtract(1, 'days'), 'day')
        dateQualifier = "yesterday"
      else
        dateQualifier = "on #{time.format('MMM Do, YYYY')}"
      timeQualifier = " at #{time?.tz(user.timetable?.timezone?.name).format('h:mma')} #{dateQualifier}"
      if @elapsed?
        hours = Math.floor @elapsed
        if hours is 0
          hoursStr = ''
        else if hours is 1
          hoursStr = "#{hours} hour"
        else
          hoursStr = "#{hours} hours"
        minutes = Math.round((@elapsed - hours) * 60)
        if minutes is 0
          minutesStr = ''
        else if minutes is 1
          minutesStr = "#{minutes} minute"
        else
          minutesStr = "#{minutes} minutes"
        elapsedQualifier = " (#{hoursStr}#{if minutes > 0 then ', ' else ''}#{minutesStr})"
    if @mode is 'vacation' or
       @mode is 'sick' or
       @mode is 'unpaid'
      if blockTimeQualifier?
        modeQualifier = "for #{article} #{blockTimeQualifier} #{@mode}-block"
    else if @mode is 'none' and blockTimeQualifier?
      modeQualifier = "for #{article} #{blockTimeQualifier} block"
    else
      modeQualifier = @mode
    if @projects and @projects.length > 0
      projectsQualifier = " ("
      projectsQualifier += @projects.map((el) ->
        return "##{el.name}"
      ).join(', ')
    if @notes
      if projectsQualifier
        notesQualifier = ", '#{@notes}')"
      else
        notesQualifier = " ('#{@notes}')"
      words = @notes.split ' '
      warnings =
        projects: []
        other: []
      for word in words
        if word.charAt(0) is '#'
          warnings.projects.push word
    else
      if projectsQualifier
        notesQualifier = ')'
    if warnings
      for warning in warnings.projects
        warningQualifier += "Warning: #{warning} isn't a registered project. This will be added to your notes rather than as a project.\n"
      for warning in warnings.other
        warningQualifier += "Warning: #{warning} isn't a recognized input. This will be added to your notes.\n"
    description = "#{modeQualifier}#{timeQualifier}#{elapsedQualifier}#{projectsQualifier}#{notesQualifier}\n#{warningQualifier}"

    return description

_mergeDateTime = (date, time, tz=TIMEZONE) ->
  return moment.tz({
    year: date.get('year'),
    month: date.get('month'),
    date: date.get('date'),
    hour: time.get('hour'),
    minute: time.get('minute'),
    second: time.get('second')
  }, tz)

_parseMode = (command) ->
  comps = command.split ' '
  [mode, command] = [comps.shift(), comps.join ' ']
  mode = (mode || '').toLowerCase().trim()
  command = (command || '').trim()
  if mode in MODES
    [mode, command]
  else
    ['none', command]

_parseTime = (command, activeStart, activeEnd) ->
  # parse time component
  command = command.trimLeft() || ''
  if command.indexOf('at') is 0
    command = command.replace 'at', ''
    command = command.trimLeft()
  activeTime = (activeEnd.diff(activeStart, 'hours', true).toFixed(2))
  time = []
  if match = command.match REGEX.rel_time
    if match[0] is 'half-day' or match[0] is 'half day'
      halfTime = activeTime / 2
      midTime = moment(activeStart).add(halfTime, 'hours')
      period = if moment().diff(activeStart, 'hours', true) <= halfTime then 'early' else 'later'
      if period is 'early'
        # start to mid
        time.push moment(activeStart), midTime
      else
        # mid to end
        time.push midTime, moment(activeEnd)
    else if match[0] is 'noon'
      time.push moment({hour: 12, minute: 0})
    else if match[0] is 'midnight'
      time.push moment({hour: 0, minute: 0})
    else
      block_str = match[0].replace('hours', '').replace('hour', '').trimRight()
      block = parseFloat block_str
      time.block = block
    command = command.replace ///#{match[0]} ?///i, ''
  else if match = command.match REGEX.time
    timeMatch = match[0]
    if hourStr = timeMatch.match /\b((0?[1-9]|1[0-2])|(([0-1][0-9])|(2[0-3]))):/i
      hour = parseInt(hourStr[0].replace(':', ''))
      if hour <= 12
        period = moment().format('a')
        if not timeMatch.match /(a|p)m?/i
          timeMatch = "#{timeMatch} #{period}"
    today = moment(timeMatch, 'h:mm a')
    time.push today
    command = command.replace ///#{match[0]} ?///i, ''
  # else if match = command.match regex for time ranges (???)
  [time, command]

_parseDate = (command) ->
  command = command.trimLeft() || ''
  if command.indexOf('on') is 0
    command = command.replace 'on', ''
    command = command.trimLeft()
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

_calculateElapsed = (start, end, mode, user) ->
  elapsed = end.diff(start, 'hours', true)
  if mode is 'vacation' or
     mode is 'sick'
    [activeStart, activeEnd] = user.activeHours()
    activeTime = user.activeTime()
    inactiveTime = +moment(activeStart)
                    .add(1, 'days')
                    .diff(activeEnd, 'hours', true)
                    .toFixed(2)
    if start? and start.isValid() and end? and end.isValid()
      numDays = end.diff(start, 'days')

      holidays = 0
      currentDate = moment start
      while currentDate.isSameOrBefore end
        holiday_str = currentDate.holiday()
        dayOfWeek = currentDate.day()
        if holiday_str? and
           dayOfWeek isnt 0 and
           dayOfWeek isnt 6
          holidays += 1
        currentDate.add 1, 'days'

      numWorkdays = weekend.diff(start, end) - holidays
      numWeekends = numDays - numWorkdays

    if elapsed > activeTime and
       numDays?
      elapsed -= (inactiveTime * numDays) + (activeTime * numWeekends)
  elapsed

_parseProjects = (command) ->
  projects = []
  command = command.trimLeft() || ''
  if command.indexOf('in') is 0
    command = command.replace 'in', ''
    command = command.trimLeft()
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
