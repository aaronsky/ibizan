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
      PROJECT_HEADERS = HEADERS.projects
      for row in rows
        if row[PROJECT_HEADERS.name]
          name = row[PROJECT_HEADERS.name].trim()
        if row[PROJECT_HEADERS.start]
          startDate = moment(row[PROJECT_HEADERS.start], 'MM/DD/YYYY')
        if row[PROJECT_HEADERS.total]
          total = parseInt row[PROJECT_HEADERS.total]
        project = new Project(name, startDate, total)
        projects.push project
      cb projects
  loadEmployees: (worksheet, cb) ->
    worksheet.getRows (err, rows) ->
      if err
        throw err
      users = []
      USER_HEADERS = HEADERS.users
      today = moment()
      for row in rows
        temp = {}
        for key, header of USER_HEADERS
          if header is USER_HEADERS.start or header is USER_HEADERS.end
            row[header] = row[header].toLowerCase()
            if row[header] is 'midnight'
              row[header] = '12:00 am'
            else if row[header] is 'noon'
              row[header] = '12:00 pm'
            temp[key] = moment("#{today.format("YYYY-MM-DD")} #{row[header]}")
          else if header is USER_HEADERS.salary
            temp[key] = row[header] is 'Y'
          else
            if isNaN(row[header])
              temp[key] = row[header].trim()
            else
              temp[key] = parseInt row[header]
        timetable = new Timetable(temp.start, temp.end, temp.timezone)
        timetable.setVacation(temp.vacationAvailable, temp.vacationLogged)
        timetable.setSick(temp.sickAvailable, temp.sickLogged)
        timetable.setUnpaid(temp.unpaidLogged)
        timetable.setOvertime(temp.overtime)
        timetable.setLogged(temp.totalLogged)
        timetable.setAverageLogged(temp.averageLogged)
        user = new User(temp.name, temp.slackname, temp.salary, timetable)
        users.push user
      cb users
  enterPunch: (punch, user, cb) ->
    # code
    if not punch or not user
      cb(new Error('Invalid parameters passed: Punch or user is undefined.'))
      return
    headers = HEADERS.rawdata
    if user.lastPunch and user.lastPunch.mode is 'in' and punch.mode is 'out'
      row = user.lastPunch.row
      row[headers.out] = punch.times[0].format('hh:mm:ss A')
      elapsed = punch.times[0].diff(user.lastPunch.times[0], 'hours', true)
      hours = Math.floor elapsed
      minutes = Math.round((elapsed - hours) * 60)
      row[headers.totalTime] = "#{hours}:#{if minutes < 10 then "0#{minutes}" else minutes}:00"
      extraProjectCount = user.lastPunch.projects.length
      for project in punch.projects
        if extraProjectCount >= 6
          break
        if project not in user.lastPunch.projects
          extraProjectCount += 1
          row[headers["project#{extraProjectCount}"]] = "##{project.name}"
      if punch.notes
        row[headers.notes] = "#{user.lastPunch.notes}\n#{punch.notes}" 
      row.save (err) ->
        if err
          cb(err)
          return
        # add hours to project in projects
        cb()
    else if punch.mode is 'vacation' or punch.mode is 'sick' or punch.mode is 'unpaid'
      # do these go in raw data?
      # error if exceeds available
      # add to user numbers
      # save user row
    else
      row = punch.toRawRow user.name
      @rawData.addRow row, (err) =>
        if err
          cb(err)
          return
        # HACK: This is still wrong
        params = 
          orderby: "column:#{headers.id}"
          reverse: true
          sq: encodeURIComponent "select * where #{headers.id} = #{row[headers.id]}"
        @rawData.getRows params, (err, rows) =>
          if err or not rows
            cb(err)
            return
          # HACK: THIS NEEDS STRESS TESTING
          console.log rows.length
          punch.assignRow rows[0]
          user.setLastPunch punch
          cb()

  generateReport: () ->
    # code
    # foreach user
    #   create row obj
    #   get total hours * days for each field
    #   add row to sheet

module.exports = Spreadsheet