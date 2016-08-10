# Description:
#   Your dog friend guards access to your most prized commands
#
# Commands:
#
# Author:
#   bcoia

{ ADMIN_COMMANDS, HEADERS, STRINGS } = require '../helpers/constants'
strings = STRINGS.access

Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user in process.env.ADMINS.split(" ")

  robot.listenerMiddleware (context, next, done) ->
    username = context.response.message.user.name
    if username is 'hubot' or username is 'ibizan'
      # Ignore myself
      done()
      return
    else
      if not Organization.ready()
        # Organization is not ready, ignore command
        context.response.send strings.orgnotready
        Logger.addReaction 'x', context.response.message
        done()
        return
      else
        command = context.listener.options.id
        Logger.debug "Responding to '#{context.response.message}' (#{command}) from #{username}"
        if command in ADMIN_COMMANDS
          if not isAdminUser username
            # Admin command, but user isn't in whitelist
            context.response.send strings.adminonly
            Logger.addReaction 'x', context.response.message
            done()
            return
        if context.listener.options.userRequired
          user = Organization.getUserBySlackName username
          if not user
            # Slack user does not exist in Employee sheet, but user is required
            context.response.send strings.notanemployee
            Logger.addReaction 'x', context.response.message
            done()
            return
        # All checks passed, continue
        next()
