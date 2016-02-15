
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
      [mode, command] = parseMode command

    [start, end] = user.activeHours()
    [times, command] = parseTime command, start, end
    [dates, command] = parseDate command

    datetimes = []
    if times.length > 0 and dates.length > 0
      for date in dates
        for time in times
          datetime = moment(date)
          datetime.hour(time.hour())
          datetime.minute(time.minute())
          datetime.second(time.second())
          datetimes.push datetime
    else if times.length > 0
      datetimes = times
    else if dates.length > 0
      datetimes = dates

    if times.block?
      datetimes.block = times.block

    [projects, command] = parseProjects command
    notes = command.trim()

    punch = new Punch(mode, datetimes, projects, notes)
    punch

  toRawRow: (name) ->
    headers = HEADERS.rawdata
    row = {}
    row[headers.id] = uuid.v1()
    row[headers.today] = moment().format('MM/DD/YYYY')
    row[headers.name] = name
    if @times.block?
      block = @times.block
      hours = Math.floor block
      minutes = Math.round((block - hours) * 60)
      row[headers.blockTime] = "#{hours}:#{if minutes < 10 then "0#{minutes}" else minutes}:00"
    else
      row[headers[@mode]] = @times[0].format('hh:mm:ss A')
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
    return true

  parseMode = (command) ->
    comps = command.split ' '
    [mode, command] = [comps.shift(), comps.join ' ']
    mode = (mode || '').trim()
    command = (command || '').trim()
    if mode in MODES
      [mode, command]
    else
      ['none', command]

  parseTime = (command, activeStart, activeEnd) ->
    # parse time component
    command = command.trimLeft() || ''
    time = []
    if match = command.match REGEX.rel_time
      if match[0] is 'half-day' or match[0] is 'half day'
        copy = moment(activeStart)
        copy.hour(activeStart.hour() - 4)
        time.push copy, activeEnd
      else
        block = parseFloat match[3]
        time.block = block
      command = command.replace ///#{match[0]} ?///i, ''
    else if match = command.match REGEX.twelvetime
      # TODO: DRY
      # do something with the absolutism
      today = moment()
      time.push moment("#{today.format('YYYY-MM-DD')} #{match[0]}")
      command = command.replace ///#{match[0]} ?///i, ''
    else if match = command.match REGEX.twentyfourtime
      today = moment()
      time.push moment("#{today.format('YYYY-MM-DD')} #{match[0]}")
      command = command.replace ///#{match[0]} ?///i, ''
    # else if match = command.match regex for time ranges (???)
    else
      time.push moment()
    [time, command]

  parseDate = (command) ->
    command = command.trimLeft() || ''
    thisYear = moment().year()
    date = []
    if match = command.match /today/i
      date.push moment()
      command = command.replace ///#{match[0]} ?///i, ''
    else if match = command.match /yesterday/i
      yesterday = moment().subtract(1, 'days')
      date.push yesterday
      command = command.replace ///#{match[0]} ?///i, ''
    else if match = command.match /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i
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
          if not month
            if month = str.match REGEX.months
              month = month[0]
              str = str.replace(month, '').trim()
          date.push moment("#{month} #{str}").year(thisYear)
      else
        absDate = moment(match[0]).year(thisYear)
        date.push absDate
      command = command.replace ///#{match[0]} ?///i, ''
    else
      date.push moment()
    [date, command]

  parseProjects = (command) ->
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