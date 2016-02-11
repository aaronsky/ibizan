moment = require 'moment'

getPositiveNumber = (input, current) ->
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
  setOvertime: (total) ->
    @overtimeTotal = getPositiveNumber(total, @overtimeTotal)
  setLogged: (total) ->
    @loggedTotal = getPositiveNumber(total, @loggedTotal)
  setAverageLogged: (average) ->
    @averageLoggedTotal = getPositiveNumber(average, @averageLoggedTotal)

class User
  constructor: (@name, @slack, @salary, @timetable) ->
    @lastPunch = null
    @shouldHound = true
  activeHours: () ->
    [@timetable.start, @timetable.end]
  isInactive: (current) ->
    current = current || moment()
    not current.isBetween(@timetable.start, @timetable.end)

module.exports.User = User
module.exports.Timetable = Timetable