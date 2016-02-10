  
CONSTANTS = require '../helpers/constants'
REGEX = CONSTANTS.REGEX
MODES = ['in', 'out', 'vacation', 'unpaid', 'sick']
Organization = require('../models/organization').get()

class Punch
  constructor: (@user, 
                @mode = 'none', 
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
    datetimes = []
    [times, command] = parseTime command, start, end
    [dates, command] = parseDate command
    for date in dates
      for time in times
        datetime = new Date(date)
        datetime.setHours time.getHours()
        datetime.setMinutes time.getMinutes()
        datetime.setSeconds time.getSeconds()
        datetimes.push datetime
    if times.block?
      datetimes.block = times.block

    [projects, command] = parseProjects command
    notes = command

    punch = new Punch(user, mode, datetimes, projects, notes)
    punch

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
    command = command || ''
    time = []
    if match = command.match REGEX.rel_time
      if match[0] is 'half-day' or match[0] is 'half day'
        copy = new Date(activeStart.getTime())
        copy.setHours(activeStart.getHours() - 4)
        time.push copy, activeEnd
      else
        block = parseFloat match[3]
        time.block = block
      command = command.replace(match[0], '').trimLeft()
    else if match = command.match REGEX.time
      # TODO: DRY
      # do something with the absolutism
      today = new Date()
      today_str = "#{today.getFullYear()}-#{today.getMonth()}-#{today.getDate()} "
      time.push new Date(today_str + match[0])
      command = command.replace(match[0] + ' ', '')
    # else if match = command.match regex for time ranges (???)
    else
      time.push new Date()
    [time, command]

  parseDate = (command) ->
    command = command || ''
    date = []
    if match = command.match /today/i
      date.push new Date()
      command = command.replace(match[0] + ' ', '')
    else if match = command.match /yesterday/i
      today = new Date()
      today.setDate(today.getDate() - 1)
      date.push today
      command = command.replace(match[0] + ' ', '')
      [date, command]
    else if match = command.match REGEX.date # Placeholder for date blocks
      absDate = new Date(match[0])
      absDate.setFullYear(new Date().getFullYear())
      date.push absDate
      command = command.replace(match[0] + ' ', '')
    else
      date.push new Date()
    [date, command]

  parseProjects = (command) ->
    projects = []
    command = command || ''
    command_copy = command.split(' ').slice()

    for word in command_copy
      if word.charAt(0) is '#'
        if project = Organization.getProjectByName word
          projects.push project
        command = command.replace word + ' ', ''
      else
        break
    [projects, command]

module.exports = Punch