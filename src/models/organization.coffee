
moment = require 'moment'
Q = require 'q'

{ HEADERS } = require '../helpers/constants'
Logger = require('../helpers/logger')()
{ Calendar, CalendarEvent } = require './calendar'
Spreadsheet = require './sheet'
{ Settings } = require './user'

CONFIG =
  sheet_id: process.env.SHEET_ID
  auth:
    client_email: process.env.CLIENT_EMAIL
    private_key: process.env.PRIVATE_KEY

NAME = process.env.ORG_NAME

# Singleton
class Organization
  instance = null

  class OrganizationPrivate
    constructor: (id) ->
      @name = NAME || 'Bad organization name'
      sheet_id = id || CONFIG.sheet_id
      if sheet_id
        @spreadsheet = new Spreadsheet(sheet_id)
        Logger.fun "Welcome to #{@name}!"
        @initTime = moment()
        if @spreadsheet.sheet
          @sync().done(() -> Logger.log('Options loaded'))
      else
        Logger.warn 'Sheet not initialized, no spreadsheet ID was provided'
    ready: () ->
      if @spreadsheet
        return @spreadsheet.initialized
      return false
    sync: (auth) ->
      deferred = Q.defer()
      @spreadsheet.authorize(auth || CONFIG.auth)
      .then(@spreadsheet.loadOptions.bind(@spreadsheet))
      .then(
        (opts) =>
          if opts
            @houndFrequency = opts.houndFrequency
            if @users
              old = @users.slice(0)
            @users = opts.users
            if old
              for user in old
                if newUser = @getUserBySlackName user.slack
                  newUser.settings = Settings.fromSettings user.settings
            @projects = opts.projects
            @calendar = new Calendar(opts.vacation, opts.sick, opts.holidays, opts.payweek, opts.events)
            @clockChannel = opts.clockChannel
            @exemptChannels = opts.exemptChannels
        )
        .catch((error) -> deferred.reject(error))
        .done(() -> deferred.resolve(true))
      deferred.promise
    getUserBySlackName: (name, users) ->
      if not users
        users = @users
      if users
        for user in users
          if name is user.slack
            return user
      Logger.debug "User #{name} could not be found"
    getUserByRealName: (name, users) ->
      if not users
        users = @users
      if users
        for user in users
          if name is user.name
            return user
      Logger.debug "Person #{name} could not be found"
    getProjectByName: (name, projects) ->
      if not projects
        projects = @projects
      name = name.replace '#', ''
      if projects
        for project in @projects
          if name is project.name
            return project
      Logger.debug "Project #{name} could not be found"
    addEvent: (date, name) ->
      deferred = Q.defer()
      date = moment(date, 'MM/DD/YYYY')
      if not date.isValid()
        deferred.reject "Invalid date given to addEvent"
      else if not name? or not name.length > 0
        deferred.reject "Invalid name given to addEvent"

      calendarevent = new CalendarEvent(date, name)
      calendar = @calendar
      @spreadsheet.addEventRow(calendarevent.toEventRow())
      .then(
        () ->
          calendar.events.push calendarevent
          deferred.resolve calendarevent
      )
      .catch(
        (err) ->
          deferred.reject "Could not add event row: #{err}"
      )
      .done()
      deferred.promise
    generateReport: (start, end, send=false) ->
      deferred = Q.defer()
      if not @spreadsheet
        deferred.reject 'No spreadsheet is loaded, report cannot be generated'
        return
      else if not start or not end
        deferred.reject 'No start or end date were passed as arguments'
        return

      Logger.log "Generating payroll from #{start.format('MMM Do, YYYY')}
                  to #{end.format('MMM Do, YYYY')}"
      headers = HEADERS.payrollreports
      reports = []
      for user in @users
        row = user.toRawPayroll(start, end)
        if row
          reports.push row
      reports.sort((left, right) ->
        if left[headers.logged] < right[headers.logged] or
           left[headers.vacation] < left[headers.vacation] or
           left[headers.sick] < left[headers.sick] or
           left[headers.unpaid] < left[headers.unpaid]
          return -1
        else if left[headers.logged] > right[headers.logged] or
                left[headers.vacation] > left[headers.vacation] or
                left[headers.sick] > left[headers.sick] or
                left[headers.unpaid] > left[headers.unpaid]
          return 1
        return 0
      )
      if send
        @spreadsheet.generateReport(reports)
        .done((numberDone) -> deferred.resolve(reports))
      else
        deferred.resolve reports
      deferred.promise
    resetHounding: () ->
      i = 0
      for user in @users
        if user.settings?.shouldResetHound
          user.settings.fromSettings {
            shouldHound: true
          }
        i += 1
      i
    setHoundFrequency: (frequency) ->
      i = 0
      for user in @users
        user.settings.fromSettings {
          houndFrequency: frequency
        }
        i += 1
      i
    setShouldHound: (should) ->
      i = 0
      for user in @users
        user.settings.fromSettings {
          shouldHound: should
        }
        i += 1
      i
  @get: (id) ->
    instance ?= new OrganizationPrivate(id)
    instance

module.exports = Organization
