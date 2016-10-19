
moment = require 'moment'
Q = require 'q'

{ HEADERS, TIMEZONE } = require '../helpers/constants'
Logger = require('../helpers/logger')()

class Calendar
  constructor: (@vacation, @sick, @holidays, @referencePayWeek, @events) ->
  isPayWeek: () ->
    return (moment().diff(@referencePayWeek, 'weeks') % 2) is 0
  upcomingEvents: (date = moment()) ->
    @events.sort (a, b) ->
      return moment.utc(a.date).diff(moment.utc(b.date))
    upcomingEvents = []
    for calendarevent in @events
      if calendarevent.date.isAfter(date)
        upcomingEvents.push calendarevent
    return upcomingEvents
  description: () ->
    str = "Organization calendar:\n"
    for holiday in @holidays
      str += "This year's #{holiday.name} is on
              #{holiday.date.format('MM/DD/YYYY')}\n"
    return str

class CalendarEvent
  constructor: (@date, @name, @row = null) ->
  daysUntil: () ->
    return @date.diff(moment(), 'days')
  @parse: (row) ->
    if not row
      return
    headers = HEADERS.events
    if row[headers.date]
      date = moment(row[headers.date], 'MM/DD/YYYY')
    if row[headers.name]
      name = row[headers.name].trim()
    calendarevent = new CalendarEvent(date, name, row)
    calendarevent
  toEventRow: () ->
    headers = HEADERS.events
    row = @row or {}
    row[headers.date] = row[headers.date] or @date.format('MM/DD/YYYY')
    row[headers.name] = row[headers.name] or @name
    row
  updateRow: () ->
    deferred = Q.defer()
    if @row?
      headers = HEADERS.events
      @row[headers.date] = @date.format('MM/DD/YYYY')
      @row[headers.name] = "##{@name}"
      @row.save (err) ->
        if err
          deferred.reject err
        else
          deferred.resolve()
    else
      deferred.reject 'Row is null'
    deferred.promise
  description: () ->
    return "Project: #{@name}\n
            Start date: #{@start.format('MM/DD/YYYY')}\n
            Total hours: #{@total}"

module.exports.Calendar = Calendar
module.exports.CalendarEvent = CalendarEvent
