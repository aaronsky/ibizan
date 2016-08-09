# Description:
#   Your dog friend makes sure everything's in order
#
# Commands:
#
# Notes:
#
# Author:
#   aaronsky

moment = require 'moment'
require 'moment-precise-range-plugin'

{ HEADERS, STRINGS } = require '../helpers/constants'
strings = STRINGS.diagnostics

Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user in process.env.ADMINS.split(" ")

  robot.respond /uptime/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      res.send "#{Organization.name}'s Ibizan has been up since
                #{Organization.initTime.toDate()}
                _(#{moment().preciseDiff(Organization.initTime)})_"
      Logger.addReaction 'dog2', res.message

  robot.respond /users/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      user = Organization.getUserBySlackName res.message.user.name
      if not isAdminUser res.message.user.name
        user.directMessage strings.adminonly, Logger
        Logger.addReaction 'x', res.message
      else
        response = 'All users:'
        attachments = []
        for u in Organization.users
          attachments.push u.slackAttachment()
        user.directMessage response, Logger, attachments
        Logger.addReaction 'dog2', res.message

  robot.respond /projects/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      user = Organization.getUserBySlackName res.message.user.name
      if not isAdminUser res.message.user.name
        user.directMessage strings.adminonly, Logger
        Logger.addReaction 'x', res.message
      else
        response = ''
        for project in Organization.projects
          response += project.description() + '\n\n'
        user.directMessage response, Logger
        Logger.addReaction 'dog2', res.message

  robot.respond /calendar/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      user = Organization.getUserBySlackName res.message.user.name
      if isAdminUser res.message.user.name
        user.directMessage Organization.calendar.description(), Logger
        Logger.addReaction 'dog2', res.message
      else
        user.directMessage strings.adminonly, Logger
        Logger.addReaction 'x', res.message

  robot.respond /sync/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      Logger.addReaction 'clock4', res.message
      Organization.sync()
      .catch(
        (err) ->
          Logger.errorToSlack "Failed to resync", err
          Logger.removeReaction 'clock4', res.message
          Logger.addReaction 'x', res.message
      )
      .done(
        (status) ->
          res.send "Resynced with spreadsheet"
          Logger.removeReaction 'clock4', res.message
          Logger.addReaction 'dog2', res.message
      )

  robot.respond /help/i, (res) ->
    if not Organization.ready()
      res.send strings.orgnotready
      Logger.addReaction 'x', res.message
    else
      user = Organization.getUserBySlackName res.message.user.name
      user.directMessage strings.help, Logger
      Logger.addReaction 'dog2', res.message
