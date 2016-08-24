
moment = require 'moment'
Q = require 'q'

{ HEADERS } = require '../helpers/constants'
Logger = require('../helpers/logger')()
Spreadsheet = require './sheet'

class Calendar
  constructor: (@vacation, @sick, @holidays, @referencePayWeek) ->
  isPayWeek: () ->
    return (moment().diff(@referencePayWeek, 'weeks') % 2) is 0
  description: () ->
    str = "Organization calendar:\n"
    for holiday in @holidays
      str += "This year's #{holiday.name} is on
              #{holiday.date.format('MM/DD/YYYY')}\n"
    return str

module.exports = Calendar
