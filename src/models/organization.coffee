
moment = require 'moment'
Q = require 'q'

Logger = require('../helpers/logger')()
Spreadsheet = require './sheet'

CONFIG =
  sheet_id: process.env.SHEET_ID
  auth:
    client_email: process.env.CLIENT_EMAIL
    private_key: process.env.PRIVATE_KEY

NAME = process.env.ORG_NAME

class Calendar
  constructor: (@vacation, @sick, @holidays) ->

# Singleton
class Organization
  instance = null

  class OrganizationPrivate
    constructor: (@name = NAME) ->
      if CONFIG.sheet_id
        @spreadsheet = new Spreadsheet(CONFIG.sheet_id)
        Logger.log "Welcome to #{@name}!"
        @initTime = moment()
        @sync()
        .done(() -> Logger.log('Options loaded'))
      else
        Logger.warn 'Sheet not initialized, no spreadsheet ID was provided'
    sync: () ->
      deferred = Q.defer()
      @spreadsheet.authorize(CONFIG.auth)
      .then(@spreadsheet.loadOptions.bind(@spreadsheet))
      .then(
        (opts) =>
          if opts
            @users = opts.users
            @projects = opts.projects
            @calendar = new Calendar(opts.vacation, opts.sick, opts.holidays)
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
      Logger.log "user #{name} could not be found"
    getUserByRealName: (name, users) ->
      if not users
        users = @users
      if users
        for user in users
          if name is user.name
            return user
      Logger.log "user #{name} could not be found"
    getProjectByName: (name, projects) ->
      if not projects
        projects = @projects
      name = name.replace '#', ''
      if projects
        for project in @projects
          if name is project.name
            return project
      Logger.log "Project #{name} could not be found"
    generateReport: () ->
      deferred = Q.defer()
      if @spreadsheet
        @spreadsheet.generateReport(@users)
        .done((numberDone) -> deferred.resolve(numberDone))
      else
        deferred.reject 'Spreadsheet was not loaded, report cannot be generated'
      deferred.promise
    resetHounding: () ->
      i = 0
      for user in @users
        user.shouldHound = true
        i += 1
      i
  @get: () ->
    instance ?= new OrganizationPrivate()
    instance

module.exports = Organization
