
moment = require 'moment'
Q = require 'q'

constants = require '../helpers/constants'
HEADERS = constants.HEADERS

class Project
  constructor: (@name = '', @start, @total, @row = null) ->
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
      if isNaN(row[headers.total])
        total = 0
      else
        total = parseInt row[headers.total]
    project = new Project(name, startDate, total, row)
    project

  updateRow: () ->
    deferred = Q.defer()
    if @row?
      headers = HEADERS.projects
      @row[headers.name] = "##{@name}"
      @row[headers.start] = @start.format('MM/DD/YYYY')
      @row[headers.total] = Math.floor @total
      @row.save (err) ->
        if err
          deferred.reject err
        else
          deferred.resolve()
    else
      deferred.reject 'Row is null'
    deferred.promise
  
module.exports = Project