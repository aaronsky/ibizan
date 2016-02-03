class Timetable
  constructor: (@start, @end, @timezone) ->
    # ...

  setVacation: (total, available) ->
    @vacationTotal = total
    @vacationAvailable = available
  setSick: (total, available) ->
    @sickTotal = total
    @sickAvailable = available
  setUnpaid: (total) ->
    @unpaidTotal = total
  setOvertime: (total) ->
    @overtimeTotal = total
  setLogged: (total) ->
    @loggedTotal = total
  setAverageLogged: (average) ->
    @averageLoggedPerWeek = average

class User
  constructor: (@name, @slack, @salary, @timetable) ->
    @shouldHound = true
  activeHours: () ->
    [@timetable.start, @timetable.end]
  isInactive: () ->
    current = Date.now()
    current > @timetable.start and current < @timetable.end

module.exports.User = User
module.exports.Timetable = Timetable