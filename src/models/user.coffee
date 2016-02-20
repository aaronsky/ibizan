moment = require 'moment'
constants = require '../helpers/constants'
HEADERS = constants.HEADERS

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
  constructor: (@name, @slack, @salary, @timetable) ->
    @lastPunch = null
    @shouldHound = true
  @parse: () ->
    headers = HEADERS.users
  activeHours: () ->
    [@timetable.start, @timetable.end]
  activeTime: () ->
    @timetable.end.diff(@timetable.start, 'hours', true)
  isInactive: (current) ->
    current = current || moment()
    not current.isBetween(@timetable.start, @timetable.end)
  setLastPunch: (punch) ->
    @lastPunch = punch
  undoPunch: () ->
    return
  toRawPayroll: () ->
    headers = HEADERS.payrollreports
    row = {}
    row[headers.date] = moment().format('M/DD/YYYY')
    row[headers.name] = @name
    if @salary
      row[headers.paid] = 80 - @timetable.unpaidTotal
    else
      row[headers.paid] = @timetable.loggedTotal + @timetable.vacationTotal + @timetable.sickTotal
    row[headers.unpaid] = @timetable.unpaidTotal
    row[headers.logged] = @timetable.loggedTotal
    row[headers.vacation] = @timetable.vacationTotal
    row[headers.sick] = @timetable.sickTotal
    row[headers.overtime] = Math.max(0, @timetable.loggedTotal - 80)
    row[headers.holiday] = @timetable.holiday
    row
  updateRow: () ->
    if @row
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
          cb(err)
          return

module.exports.User = User
module.exports.Timetable = Timetable