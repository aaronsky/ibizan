
moment = require 'moment'

constants = require '../helpers/constants'
HEADERS = constants.HEADERS

class Project
  constructor: (@name = '', @start, @total) ->
    @name = @name.replace '#', ''
  @parse: (row) ->
    if not row
      return
    headers = HEADERS.projects
    if row[headers.name]
      name = row[headers.name].trim()
    if row[headers.start]
      startDate = moment(row[headers.start], 'MM/DD/YYYY')
    if row[headers.total]
      total = parseInt row[headers.total]
    project = new Project(name, startDate, total)
    project
  
module.exports = Project