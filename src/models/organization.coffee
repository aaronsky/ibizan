
Spreadsheet = require './sheet'

CONFIG =
  sheet_id: process.env.SHEET_ID
  auth:
    client_email: process.env.CLIENT_EMAIL
    private_key: process.env.PRIVATE_KEY

NAME = 'Fangamer'
OPTIONS = null

class Calendar
  constructor: (@vacation, @sick, @holidays) ->

# Singleton
class Organization
  instance = null

  class OrganizationPrivate
    constructor: (@name = NAME, options = OPTIONS) ->
      if CONFIG.sheet_id
        @spreadsheet = new Spreadsheet(CONFIG.sheet_id)
        that = this
        @spreadsheet.authorize CONFIG.auth, (err) ->
          if err
            return
          that.spreadsheet.loadOptions (opts) ->
            that.bindOptions opts
      else
        console.warn 'Sheet not initialized, no spreadsheet ID was provided'
    bindOptions: (opts = OPTIONS) ->
      if opts 
        if not OPTIONS
          OPTIONS = opts
        @users ?= opts.users
        @projects ?= opts.projects
        @calendar ?= new Calendar(opts.vacation, opts.sick, opts.holidays)
        @clockChannel ?= opts.clockChannel
        @exemptChannels ?= opts.exemptChannels
    getUserBySlackName: (name) ->
      if @users
        for user in @users
          if name is user.slack
            return user
      console.log "user #{name} could not be found"
    getUserByRealName: (name) ->
      if @users
        for user in @users
          if name is user.name
            return user
      console.log "user #{name} could not be found"
    getProjectByName: (name) ->
      name = name.replace '#', ''
      if @projects
        for project in @projects
          if name is project.name
            return project
      console.log "Project #{name} could not be found"

  @get: () ->
    instance ?= new OrganizationPrivate()
    instance

module.exports = Organization