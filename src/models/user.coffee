
moment = require 'moment-timezone'
Q = require 'q'

constants = require '../helpers/constants'
HEADERS = constants.HEADERS
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
    # code

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

class User
  constructor: (@name, @slack, @salary, @timetable, @row = null) ->
    @punches = []
    @shouldHound = true
    @lastMessage = null

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
        temp[key] = moment(row[header], 'hh:mm a').tz(constants.TIMEZONE)
      else if header is headers.salary
        temp[key] = row[header] is 'Y'
      else if header is headers.timezone
        if zone = moment.tz.zone row[header]
          temp[key] = zone
        else
          temp[key] = row[header]
      else if header is headers.overtime
        continue
      else
        if isNaN(row[header])
          temp[key] = row[header].trim()
        else
          temp[key] = parseInt row[header]
    timetable = new Timetable(temp.start, temp.end, temp.timezone)
    timetable.setVacation(temp.vacationAvailable, temp.vacationLogged)
    timetable.setSick(temp.sickAvailable, temp.sickLogged)
    timetable.setUnpaid(temp.unpaidLogged)
    timetable.setLogged(temp.totalLogged)
    timetable.setAverageLogged(temp.averageLogged)
    user = new User(temp.name, temp.slackname, temp.salary, timetable, row)
    user
  activeHours: () ->
    [@timetable.start, @timetable.end]
  activeTime: () ->
    return +(@timetable.end.diff(@timetable.start, 'hours', true).toFixed(2))
  isInactive: (current) ->
    current = current || moment()
    day = current.day()
    if day is 0 or day is 6
      # weekend
      return true
    else if current.holiday()?
      return true
    else if current.isBetween(@timetable.start, @timetable.end)
      return false
    else
      return true
  undoPunch: () ->
    deferred = Q.defer()
    if @punches and @punches.length > 0
      lastPunch = @punches.slice(-1)[0]
      headers = HEADERS.rawdata
      if lastPunch.mode is 'vacation' or
         lastPunch.mode is 'sick' or
         lastPunch.mode is 'unpaid'
        that = @
        deletePromise = Q.nfbind(lastPunch.row.del.bind(lastPunch))
        deferred.resolve(deletePromise().then(() -> that.punches.pop()))
      else if lastPunch.mode is 'out'
        # projects will not be touched
        lastPunch.times.pop()
        lastPunch.elapsed = null
        if lastPunch.notes.lastIndexOf("\n") > 0
          lastPunch.notes = lastPunch.notes
                              .substring(0, @notes.lastIndexOf("\n"))
        lastPunch.mode = 'in'
        lastPunch.row[headers.out] =
          lastPunch.row[headers.totalTime] =
          lastPunch.row[headers.blockTime] = ''
        lastPunch.row[headers.notes] = lastPunch.notes
        
        savePromise = Q.nfbind(lastPunch.row.save.bind(lastPunch))
        deferred.resolve(savePromise())
      else if lastPunch.mode is 'in'
        that = @
        deletePromise = Q.nfbind(lastPunch.row.del.bind(lastPunch))
        deferred.resolve(deletePromise().then(() -> that.punches.pop()))
    deferred.promise
  toRawPayroll: (start, end) ->
    headers = HEADERS.payrollreports
    row = {}
    row[headers.date] = moment.tz(constants.TIMEZONE).format('M/DD/YYYY')
    row[headers.name] = @name
    dayLength = @activeTime()
    loggedTime = unpaidTime = vacationTime = sickTime = 0
    for punch in @punches
      if punch.times[0].isBefore(start) or punch.times[0].isAfter(end)
        continue
      else if punch.mode is 'in'
        continue
      else if not punch.elapsed
        continue
      else if punch.mode is 'vacation'
        vacationTime += punch.elapsed
      else if punch.mode is 'unpaid'
        unpaidTime += punch.elapsed
      else if punch.mode is 'sick'
        sickTime += punch.elapsed
      else if punch.times.block
        loggedTime += punch.times.block
      else
        loggedTime += punch.elapsed

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
    row[headers.holiday] = @timetable.holiday
    row
  updateRow: () ->
    deferred = Q.defer()
    if @row?
      moment.tz.setDefault @timetable.timezone.name
      headers = HEADERS.users
      @row[headers.slackname] = @slack
      @row[headers.name] = @name
      @row[headers.salary] = if @salary then 'Y' else 'N'
      @row[headers.start] = @timetable.start.tz(@timetable.timezone.name).format('h:mm a')
      @row[headers.end] = @timetable.end.tz(@timetable.timezone.name).format('h:mm a')
      @row[headers.timezone] = @timetable.timezone.name || @timetable.timezone
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

  description: () ->
    return "User: #{@name} (#{@slack})\n
            Number of punch records: #{(@punches || []).length}\n
            Active time: #{@timetable.start.format('hh:mm a')} - #{@timetable.end.format('hh:mm a')}, #{@timetable.timezone.name}\n
            Last message was #{+(moment().diff(@lastMessage, 'hours', true).toFixed(2))} hours ago"

module.exports.User = User
module.exports.Timetable = Timetable
