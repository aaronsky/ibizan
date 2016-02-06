google_credentials = {
  client_email: process.env.CLIENT_EMAIL,
  private_key: process.env.PRIVATE_KEY
}

Spreadsheet = require './sheet'

CONFIG =
  sheet_id: '1owlFh2wlnerIPDSLziDUl4jECZC4pYJ0gk3IQ71OLRI'
  auth: google_credentials
NAME = 'Fangamer'
OPTIONS = {}

sheet = new Spreadsheet(CONFIG.sheet_id)
# TODO: Catch exception here
sheet.authorize CONFIG.auth, (err) ->
  if err
    # code
    return
  sheet.loadOptions (opts) ->
    OPTIONS = opts
    Organization.get().bindOptions OPTIONS

class Calendar
  constructor: (@vacation, @sick, @holidays) ->

# Singleton
class Organization
  instance = null

  class OrganizationPrivate
    constructor: (@name, @spreadsheet, options) ->
      @bindOptions(options)
    bindOptions: (opts) ->
      if opts
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
      if @projects
        for project in @projects
          if name is project.name
            return project
      console.log "Project #{name} could not be found"

  @get: () ->
    instance ?= new OrganizationPrivate(NAME, sheet, OPTIONS)
    instance

module.exports = Organization