
GoogleSpreadsheet = require 'google-spreadsheet'
Q = require 'q'
moment = require 'moment'

require '../../lib/moment-holidays.js'
constants = require '../helpers/constants'
Logger = require('../helpers/logger')()
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
      else
        Logger.log 'Authorized successfully'
        deferred.resolve()
    Logger.log 'waiting for authorization'
    deferred.promise

  loadOptions: () ->
    deferred = Q.defer()
    @sheet.getInfo (err, info) =>
      if err
        deferred.reject err
      else
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

        if not (@rawData and
                @payroll and
                @variables and
                @projects and
                @employees)
          deferred.reject 'worksheets failed to be associated properly'
        else
          @_loadVariables({})
          .then(@_loadProjects.bind(@))
          .then(@_loadEmployees.bind(@))
          .then(@_loadPunches.bind(@))
          .catch((error) -> deferred.reject("Couldn't download sheet data"))
          .done(
            (opts) =>
              @initialized = true
              deferred.resolve opts
          )
    return deferred.promise

  enterPunch: (punch, user) ->
    deferred = Q.defer()
    valid = punch.isValid user
    if not punch or not user
      deferred.reject 'Invalid parameters passed: Punch or user is undefined.'
    else if typeof valid is 'string'
      deferred.reject valid
    else
      headers = HEADERS.rawdata
      if punch.mode is 'out'
        if user.punches and
           user.punches.length > 0
          last = user.punches.slice(-1)[0]
          if last.mode is 'in'
            last.out punch
            row = last.toRawRow user.name
            row.save (err) ->
              if err
                deferred.reject err
              else
                # add hours to project in projects
                if last.times.block
                  workTime = last.times.block
                else
                  workTime = last.elapsed
                user.timetable.setLogged(workTime)
                # calculate project times
                promises = []
                for project in last.projects
                  project.total += workTime
                  promises.push (project.updateRow())
                promises.push(user.updateRow())
                Q.all(promises)
                .then(
                  () ->
                    deferred.resolve()
                )
                .catch(
                  (err) ->
                    deferred.reject err
                )
                .done()
          else
            deferred.reject 'out punch for no in punch'
        else
          deferred.reject 'out punch for no in punch'
      else if punch.mode is 'vacation' or
              punch.mode is 'sick' or
              punch.mode is 'unpaid'
        row = punch.toRawRow name
        row[headers.blockTime]
        @rawData.addRow row, (err) ->
          if err
            deferred.reject err
          else
            if punch.times.block
              elapsed = punch.times.block
            else
              elapsed = punch.elapsed
            if punch.mode is 'vacation'
              total = user.timetable.vacationTotal
              available = user.timetable.vacationAvailable
              user.timetable.setVacation(total + elapsed, available - elapsed)
            else if punch.mode is 'sick'
              total = user.timetable.sickTotal
              available = user.timetable.sickAvailable
              user.timetable.setSick(total + elapsed, available - elapsed)
            else if punch.mode is 'unpaid'
              total = user.timetable.unpaidTotal
              user.timetable.setUnpaid(total + elapsed)
            user.updateRow()
            .catch(
              (err) ->
                deferred.reject err
            )
            .done(
              () ->
                user.punches.pop()
                deferred.resolve()
            )
        deferred.resolve()
      else
        row = punch.toRawRow user.name
        @rawData.addRow row, (err) =>
          if err
            deferred.reject err
          else
            params = {}
            @rawData.getRows params, (err, rows) ->
              if err or not rows
                deferred.reject err
              else
                row_match =
                  (r for r in rows when r[headers.id] is row[headers.id])[0]
                # Logger.log !!row_match
                punch.assignRow row_match
                user.punches.push punch
                deferred.resolve()
    deferred.promise

  generateReport: (users) ->
    deferred = Q.defer()
    numberDone = 0

    for user in users
      row = user.toRawPayroll()
      @payroll.addRow row, (err) ->
        if err
          deferred.reject err, numberDone
        else
          numberDone += 1
          if numberDone >= users.length
            deferred.resolve numberDone
    deferred.promise

  _loadVariables: (opts) ->
    deferred = Q.defer()
    @variables.getRows (err, rows) ->
      if err
        deferred.reject err
      else
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
                date =
                  moment().fromHolidayString(row[VARIABLE_HEADERS.holidayDate])
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
      else
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
      else
        users = []
        for row in rows
          user = User.parse row
          users.push user
        opts.users = users
        deferred.resolve opts
    deferred.promise

  _loadPunches: (opts) ->
    # HACK: THIS IS CHEATING
    Punch = require './punch'
    deferred = Q.defer()
    @rawData.getRows (err, rows) ->
      if err
        deferred.reject err
      else
        for row in rows
          user = opts.users.filter((item, index, arr) ->
            return item.name is row[HEADERS.rawdata.name]
          )[0]
          punch = Punch.parseRaw user, row
          if punch and user
            user.punches.push punch
        deferred.resolve opts


    deferred.promise

module.exports = Spreadsheet
