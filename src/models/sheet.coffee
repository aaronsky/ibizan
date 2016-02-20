
GoogleSpreadsheet = require 'google-spreadsheet'
Q = require 'q'
moment = require 'moment'

require '../../lib/moment-holidays.js'
constants = require '../helpers/constants'
HEADERS = constants.HEADERS
Project = require './project'
{User, Timetable} = require './user'

options = {}

class Spreadsheet
  constructor: (sheet_id) ->
    @sheet = new GoogleSpreadsheet(sheet_id)
    @initialized = false

  authorize: (auth, cb) ->
    @sheet.useServiceAccountAuth auth, (err) ->
      if err
        console.error 'authorization failed'
        cb err
      console.log 'authorized'
      cb()
    console.log 'waiting for authorization'

  loadOptions: (cb) ->
    @sheet.getInfo (err, info) =>
      if err
        cb err
      @title = info.title
      @payroll = info.worksheets[0] # HACK
      @rawData = info.worksheets[2] # HACK
      
      # HACKS EVERYWHERE
      # loadVariables then loadProjects then loadEmployees then done
      # @loadVariables(info.worksheets[4])
      # .then(@loadProjects)
      # .then( () ->
      #   opts.projects = projects
      # )
      @loadVariables info.worksheets[4], (opts) =>
        @loadProjects info.worksheets[1], (projects) =>
          opts.projects = projects
          @loadEmployees info.worksheets[3], (users) =>
            opts.users = users
            @initialized = true
            cb opts

  loadVariables: (worksheet, cb) ->
    worksheet.getRows (err, rows) ->
      if err
        throw err
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
      cb opts

  loadProjects: (worksheet, cb) ->
    worksheet.getRows (err, rows) ->
      if err
        throw err
      projects = []
      for row in rows
        project = Project.parse row
        projects.push project
      cb projects

  loadEmployees: (worksheet, cb) ->
    worksheet.getRows (err, rows) ->
      if err
        throw err
      users = []
      for row in rows
        user = User.parse row
        users.push user
      cb users

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
      console.log row
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
          # console.log !!row_match
          punch.assignRow row_match
          user.setLastPunch punch
          cb()

  generateReport: (users, completion) ->
    numberDone = 0;
    shouldExecute = true;

    for user in users
      if shouldExecute
        row = user.toRawPayroll()
        @payroll.addRow row, (err) ->
          if err
            shouldContinue = false
            completion err, numberDone
            return
          numberDone += 1;
          if numberDone >= users.length
            shouldExecute = false
            completion null, numberDone
      else
        break


module.exports = Spreadsheet