# Description:
#   Your dog friend guards access to your most prized commands
#
# Commands:
#
# Author:
#   bcoia

{ REGEX, STRINGS } = require '../helpers/constants'
strings = STRINGS.access

Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  isAdminUser = (user) ->
    return user? and user in process.env.ADMINS.split(" ")

  robot.listenerMiddleware (context, next, done) ->
    command = context.listener.options.id
    message = context.response.message
    username = context.response.message.user.name
    if username is 'hubot' or username is 'ibizan'
      # Ignore myself and messages overheard
      done()
    else if command is null
      # Ignore unknown commands or catch-alls
      next()
    else
      if not Organization.ready()
        # Organization is not ready, ignore command
        context.response.send strings.orgnotready
        Logger.addReaction 'x', message
        done()
      else
        Logger.log "Responding to '#{message}' (#{command}) from #{username}"
        if context.listener.options.adminOnly
          if not isAdminUser username
            # Admin command, but user isn't in whitelist
            context.response.send strings.adminonly
            Logger.addReaction 'x', message
            done()
        if context.listener.options.userRequired
          user = Organization.getUserBySlackName username
          if not user
            # Slack user does not exist in Employee sheet, but user is required
            context.response.send strings.notanemployee
            Logger.addReaction 'x', message
            done()
        # All checks passed, continue
        next(done)

  # Catchall for unrecognized commands
  robot.catchAll (res) ->
    if res.message.text.match(REGEX.ibizan) or
       (res.message.room and res.message.room.substring(0,1) is 'D')
      res.send "_#{res.random strings.unknowncommand}
                #{res.random strings.askforhelp}_"
      Logger.addReaction 'question', res.message
      res.finish()
