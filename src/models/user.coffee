
moment = require 'moment-timezone'
Q = require 'q'

{ HEADERS, TIMEZONE } = require '../helpers/constants'
Logger = require('../helpers/logger')()

getPositiveNumber = (input, current) ->
  if not current
    current = 0
  if not input
    return current
  if not isNaN input
    # number
    if input >= 0
      return input
    return 0
  return current

class Timetable
  constructor: (@start, @end, @timezone) ->
    if typeof @timezone is 'string'
      @timezone = moment.tz.zone(@timezone)
    @startRaw = @start
    @endRaw = @end
    @start = moment.tz(@start, 'hh:mm a', @timezone.name)
    @end = moment.tz(@end, 'hh:mm a', @timezone.name)
  activeHours: ->
    now = moment.tz @timezone.name
    start = @start.year(now.year()).dayOfYear(now.dayOfYear())
    end = @end.year(now.year()).dayOfYear(now.dayOfYear())
    [start, end]
  activeTime: ->
    rawTime = +(@end.diff(@start, 'hours', true).toFixed(2))
    return Math.min(8, rawTime)
  toDays: (hours) ->
    return hours / @activeTime()
  setVacation: (total, available) ->
    @vacationTotal = getPositiveNumber(total, @vacationTotal)
    @vacationAvailable = getPositiveNumber(available, @vacationAvailable)
  setSick: (total, available) ->
    @sickTotal = getPositiveNumber(total, @sickTotal)
    @sickAvailable = getPositiveNumber(available, @sickAvailable)
  setUnpaid: (total) ->
    @unpaidTotal = getPositiveNumber(total, @unpaidTotal)
  setLogged: (total) ->
    @loggedTotal = getPositiveNumber(total, @loggedTotal)
  setAverageLogged: (average) ->
    @averageLoggedTotal = getPositiveNumber(average, @averageLoggedTotal)
  setTimezone: (timezone) ->
    @timezone = timezone
    @start = moment.tz(@startRaw, 'hh:mm a', @timezone.name)
    @end = moment.tz(@endRaw, 'hh:mm a', @timezone.name)
  setStart: (start) ->
    @startRaw = start
    @start = moment.tz(@startRaw, 'hh:mm a', @timezone.name)
  setEnd: (end) ->
    @endRaw = end
    @end = moment.tz(@endRaw, 'hh:mm a', @timezone.name)

class Settings
  constructor: () ->
    @shouldHound = true
    @shouldResetHound = true
    @houndFrequency = -1
    @lastMessage = null
    @lastPing = null
  @fromSettings: (settings) ->
    newSetting = new Settings()
    newSetting.fromSettings settings
    newSetting
  fromSettings: (opts) ->
    if not opts or
       typeof opts isnt 'object'
      return
    for setting, value of opts
      @[setting] = value

class User
  constructor: (@name, @slack, @salary, @timetable, @row = null) ->
    @punches = []
  @parse: (row) ->
    headers = HEADERS.users
    temp = {}
    for key, header of headers
      if header is headers.start or header is headers.end
        row[header] = row[header].toLowerCase()
        if row[header] is 'midnight'
          row[header] = '12:00 am'
        else if row[header] is 'noon'
          row[header] = '12:00 pm'
        temp[key] = row[header]
      else if header is headers.salary
        temp[key] = row[header] is 'Y'
      else if header is headers.timezone
        if zone = moment.tz.zone row[header]
          temp[key] = zone
        else
          temp[key] = row[header]
      else if header is headers.shouldHound
        temp[key] = row[header] is 'Y'
      else if header is headers.houndFrequency
        temp[key] = row[header] || -1
        if temp[key] is -1
          temp.shouldResetHound = false
        else
          temp.shouldResetHound = true
      else if header is headers.overtime
        continue
      else if header is headers.lastPing
        tz = TIMEZONE
        if temp.timezone
          tz = temp.timezone.name
        temp[key] = moment.tz(row[header], 'MM/DD/YYYY hh:mm:ss A', tz)
      else
        if isNaN row[header]
          temp[key] = row[header].trim()
        else
          temp[key] = parseInt row[header]
    timetable = new Timetable(temp.start, temp.end, temp.timezone)
    timetable.setVacation(temp.vacationLogged, temp.vacationAvailable)
    timetable.setSick(temp.sickLogged, temp.sickAvailable)
    timetable.setUnpaid(temp.unpaidLogged)
    timetable.setLogged(temp.totalLogged)
    timetable.setAverageLogged(temp.averageLogged)
    user = new User(temp.name, temp.slackname, temp.salary, timetable, row)
    user.settings = Settings.fromSettings {
      shouldHound: temp.shouldHound,
      shouldResetHound: temp.shouldResetHound,
      houndFrequency: temp.houndFrequency,
      lastMessage: null,
      lastPing: temp.lastPing
    }
    return user
  activeHours: ->
    return @timetable.activeHours()
  activeTime: ->
    return @timetable.activeTime()
  setTimezone: (timezone) ->
    tz = moment.tz.zone(timezone)
    if tz
      @timetable.setTimezone(tz)
      @updateRow()
    return tz
  setStart: (start) ->
    time = moment(start, 'h:mm A')
    if time
      @timetable.setStart(time)
      @updateRow()
    return time
  setEnd: (end) ->
    time = moment(end, 'h:mm A')
    if time
      @timetable.setEnd(time)
      @updateRow()
    return time
  toDays: (hours) ->
    return @timetable.toDays hours
  isInactive: (current) ->
    current = current || moment.tz(@timetable.timezone.name)
    [start, end] = @activeHours()
    if current.holiday()?
      return true
    else if current.isBetween(start, end)
      return false
    else
      return true
  lastPunch: (modes) ->
    if typeof modes is 'string'
      modes = [modes]
    if not modes || modes.length is 0
      return @punches.slice(-1)[0]
    if @punches and @punches.length > 0
      len = @punches.length
      for i in [len-1..0]
        last = @punches[i]
        if 'in' in modes and not 'out' in modes and last.mode is 'out'
          return
        else if last.mode in modes
          return last
    return
  lastPunchTime: ->
    if @punches.length > 0
      punch = @lastPunch()
      if punch.times.length > 0
        time = punch.times.slice(-1)[0]
        if time.isSame(moment(), 'day')
          date = 'today'
        else if time.isSame(moment().subtract(1, 'days'), 'day')
          date = 'yesterday'
        else
          date = 'on ' + time.format('MMM Do')
        return "#{date}, #{time.format('h:mm a')}"
      else if punch.times.block
        if punch.mode is 'none'
          type = ' '
        else if punch.mode is 'vacation' or
                punch.mode is 'sick' or
                punch.mode is 'unpaid'
          type = punch.mode + ' '
        return "a #{punch.times.block} hour #{type}block punch"
    return "never"
  undoPunch: () ->
    deferred = Q.defer()
    lastPunch = @lastPunch()
    that = @
    Logger.log "Undoing #{that.slack}'s punch: #{lastPunch.description(that)}"
    if lastPunch.times.block
      elapsed = lastPunch.times.block
    else
      elapsed = lastPunch.elapsed || 0
    headers = HEADERS.rawdata
    if lastPunch.mode is 'vacation' or
       lastPunch.mode is 'sick' or
       lastPunch.mode is 'unpaid' or
       lastPunch.mode is 'none'
      deletePromise = Q.nfbind(lastPunch.row.del.bind(lastPunch))
      deletePromise()
      .then(() ->
        punch = that.punches.pop()
        elapsedDays = that.toDays elapsed
        if punch.mode is 'vacation'
          total = that.timetable.vacationTotal
          available = that.timetable.vacationAvailable
          that.timetable.setVacation(total - elapsedDays,
                                     available + elapsedDays)
        else if punch.mode is 'sick'
          total = that.timetable.sickTotal
          available = that.timetable.sickAvailable
          that.timetable.setSick(total - elapsedDays, available + elapsedDays)
        else if punch.mode is 'unpaid'
          total = that.timetable.unpaidTotal
          that.timetable.setUnpaid(total - elapsedDays)
        else
          logged = that.timetable.loggedTotal
          that.timetable.setLogged(logged - elapsed)
        deferred.resolve(punch)
      )
    else if lastPunch.mode is 'out'
      # projects will not be touched
      lastPunch.times.pop()
      lastPunch.elapsed = null
      if lastPunch.notes.lastIndexOf("\n") > 0
        lastPunch.notes = lastPunch.notes
                            .substring(0, lastPunch.notes.lastIndexOf("\n"))
      lastPunch.mode = 'in'
      lastPunch.row[headers.out] =
        lastPunch.row[headers.totalTime] =
        lastPunch.row[headers.blockTime] = ''
      lastPunch.row[headers.notes] = lastPunch.notes
      savePromise = Q.nfbind(lastPunch.row.save.bind(lastPunch))
      savePromise()
      .then(() ->
        logged = that.timetable.loggedTotal
        that.timetable.setLogged(logged - elapsed)
        deferred.resolve(lastPunch)
      )
    else if lastPunch.mode is 'in'
      deletePromise = Q.nfbind(lastPunch.row.del.bind(lastPunch))
      deletePromise()
      .then(() ->
        punch = that.punches.pop()
        deferred.resolve(punch)
      )
    deferred.promise
  toRawPayroll: (start, end) ->
    headers = HEADERS.payrollreports
    row = {}
    row[headers.date] = moment.tz(TIMEZONE).format('M/DD/YYYY')
    row[headers.name] = @name
    loggedTime = unpaidTime = vacationTime = sickTime = 0
    projectsForPeriod = []
    for punch in @punches
      if punch.date.isBefore(start) or punch.date.isAfter(end)
        continue
      else if not punch.elapsed and not punch.times.block
        continue
      else if punch.mode is 'in'
        continue
      else if punch.mode is 'vacation'
        if punch.times.block
          vacationTime += punch.times.block
        else
          vacationTime += punch.elapsed
      else if punch.mode is 'unpaid'
        if punch.times.block
          unpaidTime += punch.times.block
        else
          unpaidTime += punch.elapsed
      else if punch.mode is 'sick'
        if punch.times.block
          sickTime += punch.times.block
        else
          sickTime += punch.elapsed
      else
        if punch.times.block
          loggedTime += punch.times.block
        else
          loggedTime += punch.elapsed
      if punch.projects? and punch.projects?.length > 0
        for project in punch.projects
          match = projectsForPeriod.filter((item, index, arr) ->
            return project.name is item.name
          )[0]
          if not match
            projectsForPeriod.push project

    loggedTime = +loggedTime.toFixed(2)
    vacationTime = +vacationTime.toFixed(2)
    sickTime = +sickTime.toFixed(2)
    unpaidTime = +unpaidTime.toFixed(2)

    if @salary
      row[headers.paid] = 80 - unpaidTime
    else
      row[headers.paid] = loggedTime +
                          vacationTime +
                          sickTime

    row[headers.unpaid] = unpaidTime
    row[headers.logged] = loggedTime
    row[headers.vacation] = vacationTime
    row[headers.sick] = sickTime
    row[headers.overtime] = Math.max(0, loggedTime - 80)
    row[headers.holiday] = @timetable.holiday || 0
    row.extra = {
      slack: @slack,
      projects: projectsForPeriod
    }
    row
  updateRow: () ->
    deferred = Q.defer()
    if @row?
      headers = HEADERS.users
      @row[headers.start] = @timetable.start.format('h:mm A')
      @row[headers.end] = @timetable.end.format('h:mm A')
      @row[headers.timezone] = @timetable.timezone.name
      @row[headers.shouldHound] = if @settings?.shouldHound then 'Y' else 'N'
      @row[headers.houndFrequency] = if @settings?.houndFrequency then @settings.houndFrequency else -1
      @row[headers.vacationAvailable] = @timetable.vacationAvailable
      @row[headers.vacationLogged] = @timetable.vacationTotal
      @row[headers.sickAvailable] = @timetable.sickAvailable
      @row[headers.sickLogged] = @timetable.sickTotal
      @row[headers.unpaidLogged] = @timetable.unpaidTotal
      @row[headers.overtime] = Math.max(0, @timetable.loggedTotal - 80)
      @row[headers.totalLogged] = @timetable.loggedTotal
      @row[headers.averageLogged] = @timetable.averageLoggedTotal
      @row.save (err) ->
        if err
          deferred.reject err
        else
          deferred.resolve true
    else
      deferred.reject 'Row is null'
    deferred.promise
  directMessage: (msg, logger=Logger, attachment) ->
    logger.logToChannel msg, @slack, attachment, true
  hound: (msg, logger=Logger) ->
    now = moment.tz TIMEZONE
    @settings?.lastPing = now
    me = @
    if not @salary and @settings?.houndFrequency > 0
      msg = "You have been on the clock for
             #{@settings.houndFrequency} hours.\n" + msg
    setTimeout ->
      me.directMessage msg, logger
    , 1000 * (Math.floor(Math.random() * 3) + 1)
    Logger.log "Hounded #{@slack} with '#{msg}'"
  hexColor: ->
    hash = 0
    for i in [0...@slack.length]
      hash = @slack.charCodeAt(i) + ((hash << 3) - hash)
    color = Math.abs(hash).toString(16).substring(0, 6)
    hexColor = "#" + '000000'.substring(0, 6 - color.length) + color
    return hexColor
  slackAttachment: () ->
    fields = []
    statusString = "#{if @salary then 'Salary' else 'Hourly'} -
                    Active #{@timetable.start.format('h:mm a')} to
                    #{@timetable.end.format('h:mm a z')}"
    lastPunch = @lastPunch()
    if lastPunch
      lastPunchField =
        title: "Last Punch"
        value: "#{lastPunch.description(@)}"
        short: true
      fields.push lastPunchField
    houndString = "#{if @settings?.shouldHound then 'On' else 'Off'}"
    if @settings?.shouldHound
      houndString += " (#{@settings?.houndFrequency} hours)"
    houndField =
      title: "Hounding"
      value: houndString
      short: true
    fields.push houndField
    if @salary
      vacationDaysField =
        title: "Vacation Days"
        value: "#{@timetable.vacationAvailable} available,
                #{@timetable.vacationTotal} used"
        short: true
      fields.push vacationDaysField
      sickDaysField =
        title: "Sick Days"
        value: "#{@timetable.sickAvailable} available,
                #{@timetable.sickTotal} used"
        short: true
      fields.push sickDaysField
    if @unpaidTotal > 0
      unpaidField =
        title: "Unpaid Days"
        value: "#{@timetable.unpaidTotal} used"
        short: true
      fields.push unpaidField
    attachment =
      title: @name + " (@" + @slack + ")",
      text: statusString,
      fallback: @name.replace(/\W/g, '') + " @" + @slack.replace(/\W/g, '')
      color: @hexColor()
      fields: fields
    return attachment
  description: () ->
    return "User: #{@name} (#{@slack})\n
            They have #{(@punches || []).length} punches on record\n
            Last punch was #{@lastPunchTime()}\n
            Their active hours are from #{@timetable.start.format('h:mm a')} to
            #{@timetable.end.format('h:mm a')}\n
            They are in #{@timetable.timezone.name}\n
            The last time they sent a message was
            #{+(moment.tz(TIMEZONE).diff(@settings?.lastMessage?.time, 'hours', true).toFixed(2))} hours ago"

module.exports.User = User
module.exports.Settings = Settings
module.exports.Timetable = Timetable
