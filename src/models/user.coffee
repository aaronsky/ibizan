
moment = require 'moment'
Q = require 'q'

constants = require '../helpers/constants'
HEADERS = constants.HEADERS
Logger = require '../helpers/logger'

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
    @lastPunch = null
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
        temp[key] = moment(row[header], 'hh:mm a')
      else if header is headers.salary
        temp[key] = row[header] is 'Y'
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
    return +(Math.round(@timetable.end.diff(@timetable.start, 'hours', true) + "e+2")  + "e-2")
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
  setLastPunch: (punch) ->
    @lastPunch = punch
  undoPunch: () ->
    deferred = Q.defer()
    if @lastPunch
      if @lastPunch.mode is 'vacation' or
         @lastPunch.mode is 'sick' or
         @lastPunch.mode is 'unpaid'
        that = @
        deletePromise = Q.nfbind(@lastPunch.row.del.bind(@lastPunch))
        deferred.resolve(deletePromise().then(() -> that.setLastPunch(null)))
      else if @lastPunch.mode is 'out'
        # projects will not be touched
        @lastPunch.times.pop()
        @lastPunch.elapsed = null
        if @notes.lastIndexOf("\n") > 0
          @notes = @notes.substring(0, @notes.lastIndexOf("\n"))
        @lastPunch.mode = 'in'
        savePromise = Q.nfbind(@lastPunch.row.save.bind(@lastPunch))
        deferred.resolve(savePromise())
      else if @lastPunch.mode is 'in'
        that = @
        deletePromise = Q.nfbind(@lastPunch.row.del.bind(@lastPunch))
        deferred.resolve(deletePromise().then(() -> that.setLastPunch(null)))
    deferred.promise
  toRawPayroll: () ->
    headers = HEADERS.payrollreports
    row = {}
    row[headers.date] = moment().format('M/DD/YYYY')
    row[headers.name] = @name
    if @salary
      row[headers.paid] = 80 - @timetable.unpaidTotal
    else
      row[headers.paid] = @timetable.loggedTotal +
                          @timetable.vacationTotal +
                          @timetable.sickTotal

    row[headers.unpaid] = @timetable.unpaidTotal
    row[headers.logged] = @timetable.loggedTotal
    row[headers.vacation] = @timetable.vacationTotal
    row[headers.sick] = @timetable.sickTotal
    row[headers.overtime] = Math.max(0, @timetable.loggedTotal - 80)
    row[headers.holiday] = @timetable.holiday
    row
  updateRow: () ->
    deferred = Q.defer()
    if @row?
      headers = HEADERS.users
      @row[headers.slackname] = @slack
      @row[headers.name] = @name
      @row[headers.salary] = if @salary then 'Y' else 'N'
      @row[headers.start] = @timetable.start.format('H:MM A')
      @row[headers.end] = @timetable.end.format('H:MM A')
      @row[headers.timezone] = @timetable.timezone
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

module.exports.User = User
module.exports.Timetable = Timetable
