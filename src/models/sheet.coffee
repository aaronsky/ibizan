
GoogleSpreadsheet = require 'google-spreadsheet'
Q = require 'q'
moment = require 'moment'

require '../../lib/moment-holidays.js'
constants = require '../helpers/constants'
Logger = require '../helpers/logger'
HEADERS = constants.HEADERS
Project = require './project'
{User, Timetable} = require './user'

options = {}

class Spreadsheet
  constructor: (sheet_id) ->
    @sheet = new GoogleSpreadsheet(sheet_id)
    @initialized = false

  authorize: (auth) ->
    deferred = Q.defer()
    @sheet.useServiceAccountAuth auth, (err) ->
      if err
        deferred.reject err
      Logger.log 'Authorized successfully'
      deferred.resolve()
    Logger.log 'waiting for authorization'
    deferred.promise

  loadOptions: () ->
    deferred = Q.defer()
    @sheet.getInfo (err, info) =>
      if err
        deferred.reject err
      @title = info.title
      for worksheet in info.worksheets
        title = worksheet.title
        words = title.split ' '
        title = words[0].toLowerCase()
        i = 1
        while title.length < 6 and i < words.length
          title = title.concat(words[i])
          i += 1
        @[title] = worksheet

      if not (@rawData and @payroll and @variables and @projects and @employees)
        deferred.reject 'worksheets failed to be associated properly'
      else
        @_loadVariables({})
        .then(@_loadProjects.bind(this))
        .then(@_loadEmployees.bind(this))
        .catch((error) -> deferred.reject("Couldn't download sheet data"))
        .done(
          (opts) =>
            @initialized = true
            deferred.resolve opts
        )
    return deferred.promise

  enterPunch: (punch, user, cb) ->
    # code
    if not punch or not user
      cb(new Error('Invalid parameters passed: Punch or user is undefined.'))
      return
    else if not punch.isValid(user)
      cb(new Error('Punch is invalid'))
      return
    headers = HEADERS.rawdata
    if user.lastPunch and user.lastPunch.mode is 'in' and punch.mode is 'out'
      last = user.lastPunch
      last.out punch
      row = last.toRawRow user.name
      row.save (err) ->
        if err
          cb(err)
          return
        # add hours to project in projects
        if last.times.block
          workTime = last.times.block
        else
          workTime = last.elapsed
        user.timetable.setLogged(workTime)
        # calculate project times
        # setAverage
        user.updateRow()
        user.setLastPunch(null)
        cb()
    else if punch.mode is 'vacation' or
            punch.mode is 'sick' or
            punch.mode is 'unpaid'
      # do these go in raw data?
      # add to user numbers
      # save user row
    else
      row = punch.toRawRow user.name
      @rawData.addRow row, (err) =>
        if err
          cb(err)
          return
        params = {}
        @rawData.getRows params, (err, rows) ->
          if err or not rows
            cb(err)
            return
          row_match = (r for r in rows when r[headers.id] is row[headers.id])[0]
          # Logger.log !!row_match
          punch.assignRow row_match
          user.setLastPunch punch
          cb()

  generateReport: (users) ->
    deferred = Q.defer()
    numberDone = 0;

    for user in users
      row = user.toRawPayroll()
      @payroll.addRow row, (err) ->
        if err
          deferred.reject err, numberDone
          return
        numberDone += 1;
        if numberDone >= users.length
          deferred.resolve numberDone
    deferred.promise

  _loadVariables: (opts) ->
    deferred = Q.defer()
    @variables.getRows (err, rows) ->
      if err
        deferred.reject err
      opts =
        vacation: 0
        sick: 0
        holidays: {}
        clockChannel: ''
        exemptChannels: []
      VARIABLE_HEADERS = HEADERS.variables
      for row in rows
        for key, header of VARIABLE_HEADERS
          if row[header]
            if header is VARIABLE_HEADERS.holidays
              name = row[header]
              date = moment().fromHolidayString(row[VARIABLE_HEADERS.holidayDate])
              opts[key][name] = date
            else if header is VARIABLE_HEADERS.exemptChannels
              channel = row[header]
              if channel
                channel = channel.replace '#', ''
                opts[key].push channel
            else
              if isNaN(row[header])
                val = row[header]
                if val
                  opts[key] = val.trim().replace '#', ''
              else
                opts[key] = parseInt row[header]
      deferred.resolve opts
    deferred.promise

  _loadProjects: (opts) ->
    deferred = Q.defer()
    @projects.getRows (err, rows) ->
      if err
        deferred.reject err
      projects = []
      for row in rows
        project = Project.parse row
        projects.push project
      opts.projects = projects
      deferred.resolve opts
    deferred.promise

  _loadEmployees: (opts) ->
    deferred = Q.defer()
    @employees.getRows (err, rows) ->
      if err
        deferred.reject err
      users = []
      for row in rows
        user = User.parse row
        users.push user
      opts.users = users
      deferred.resolve opts
    deferred.promise

module.exports = Spreadsheet