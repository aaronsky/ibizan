
chalk = require 'chalk'
Q = require 'q'
{ STRINGS } = require '../helpers/constants'
strings = STRINGS.logger
TEST = process.env.TEST || false

if logLevelEnvString = process.env.LOG_LEVEL
  if typeof logLevelEnvString is 'string'
    logLevelEnvString = logLevelEnvString.toLowerCase()
    LOG_LEVEL = logLevelEnvString
    if LOG_LEVEL not in ['info', 'warn', 'warning', 'error', 'debug', 'true']
      LOG_LEVEL = 0
    else if LOG_LEVEL is 'debug'
      LOG_LEVEL = 4
    else if LOG_LEVEL is 'info' or LOG_LEVEL is 'true'
      LOG_LEVEL = 3
    else if LOG_LEVEL is 'warn' or LOG_LEVEL is 'warning'
      LOG_LEVEL = 2
    else if LOG_LEVEL is 'error'
      LOG_LEVEL = 1
  else if typeof logLevelEnvString is 'integer' and logLevelEnvString >= 0 and logLevelEnvString <= 4
    LOG_LEVEL = logLevelEnvString
  else
    LOG_LEVEL = 0
else
  LOG_LEVEL = 0

debugHeader = chalk.bold.green
debug = chalk.green
logHeader = chalk.bold.blue
log = chalk.blue
warnHeader = chalk.bold.yellow
warn = chalk.yellow
errHeader = chalk.bold.red
err = chalk.red
funHeader = chalk.bold.magenta
fun = chalk.magenta

class UserID
  constructor: (@id) ->
  setID: (id) ->
    @id = id
  getID: () ->
    return @id

module.exports = (robot) ->
  class Logger
    constructor: () ->
    typeIsArray = (value) ->
      value and
        typeof value is 'object' and
        value instanceof Array and
        typeof value.length is 'number' and
        typeof value.splice is 'function' and
        not ( value.propertyIsEnumerable 'length' )
    @clean: (msg) ->
      response = ''
      if typeof msg is 'string'
        message = msg
      else if typeof msg is 'object' and msg.message
        message = msg.message
      else
        message = ''
      if match = message.match(/Error: HTTP error (.*) \((?:.*)\) -/)
        errorCode = match[1]
        if errorCode is '500' or
           errorCode is '502' or
           errorCode is '404'
          response = strings.googleerror
      else
        response = message
      response
    @debug: (msg) ->
      if msg and LOG_LEVEL >= 4
        console.log(debugHeader("[Ibizan] (#{new Date()}) DEBUG: ") + debug("#{msg}"))
    @log: (msg) ->
      if msg and LOG_LEVEL >= 3
        console.log(logHeader("[Ibizan] (#{new Date()}) INFO: ") + log("#{msg}"))
    @warn: (msg) ->
      if msg and LOG_LEVEL >= 2
        console.warn(warnHeader("[Ibizan] (#{new Date()}) WARN: ") + warn("#{msg}"))
    @error: (msg, error) ->
      if msg and LOG_LEVEL >= 1
        console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{msg}"), error || '')
        if error and error.stack
          console.error(errHeader("[Ibizan] (#{new Date()}) STACK: ") + err("#{error.stack}"))
    @fun: (msg) ->
      if msg and not TEST
        console.log(funHeader("[Ibizan] (#{new Date()}) > ") + fun("#{msg}"))
    @getSlackIM: (username) ->
      deferred = Q.defer()
      if username and
         robot and
         robot.adapter and
         robot.adapter.client and
         robot.adapter.client.web and
         web = robot.adapter.client.web
        userid = new UserID(username)
        web.users.list()
        .then(
          (response) ->
            id = userid.getID()
            for member in response.members
              if member.name is id
                userid.setID member.id
                web.im.list()
                .then(
                  (response) ->
                    id = userid.getID()
                    for im in response.ims
                      if im.user is id
                        userid.setID im.id
                        deferred.resolve userid.getID()
                )
                .catch(
                  (err) ->
                    deferred.reject "Unable to list IMs in getSlackUserID - #{err}"
                )
        )
        .catch(
          (err) ->
            deferred.reject "Unable to list users in getSlackUserID - #{err}"
        )
      else
        deferred.reject "Slack web client unavailable to getSlackUserID"
      deferred.promise
    @logToChannel: (msg, channel, attachment, isUser) ->
      if msg
        if robot and robot.send?
          message = null
          if attachment and typeIsArray attachment
            message = {
              text: msg,
              parse: 'full',
              username: 'ibizan',
              icon_emoji: ':dog2:',
              attachments: attachment
            }
          else if attachment
            message = {
              text: msg,
              parse: 'full',
              username: 'ibizan',
              icon_emoji: ':dog2:',
              attachments:
                text: attachment,
                fallback: attachment.replace(/\W/g, '')
            }
          else
            message = {
              text: msg,
              parse: 'full',
              username: 'ibizan',
              icon_emoji: ':dog2:'
            }
          if isUser
            @getSlackIM channel
            .then(
              (id) ->
                if id
                  robot.send {room: id}, message
                else
                  Logger.debug "Unable to find username #{channel}"
                  robot.send {room: channel}, message
            )
          else
            @debug "Sending to room #{channel}"
            robot.send {room: channel}, message
        else
          @error "No robot available to send message: #{msg}"
    @errorToSlack: (msg, error) ->
      if msg
        if robot and robot.send?
          robot.send {room: 'ibizan-diagnostics'},
            "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
        else
          @error msg, error
    @addReaction: (reaction, message, attempt=0) ->
      if attempt > 0 and attempt <= 2
        @debug "Retrying adding #{reaction}, attempt #{attempt}..."
      if attempt >= 3
        @error "Failed to add #{reaction} to #{message} after #{attempt} attempts"
        @logToChannel strings.failedreaction, message.user.name
      else if message and
              robot and
              robot.adapter and
              robot.adapter.client and
              robot.adapter.client.web and
              web = robot.adapter.client.web
        params =
          channel: message.room,
          timestamp: message.id
        setTimeout ->
          web.reactions.add reaction, params
          .then(
            (response) ->
              if attempt >= 1
                Logger.debug "Added #{reaction} to #{message} after #{attempt} attempts"
          )
          .catch(
            (err) ->
              attempt += 1
              Logger.addReaction reaction, message, attempt
          )
        , 1000 * attempt
      else
        @error "Slack web client unavailable"
    @removeReaction: (reaction, message, attempt=0) ->
      if attempt > 0 and attempt <= 2
        @debug "Retrying removal of #{reaction}, attempt #{attempt}..."
      if attempt >= 3
        @error "Failed to remove #{reaction} from #{message} after #{attempt} attempts"
        @logToChannel strings.failedreaction, message.user.name
      else if message and
              robot and
              robot.adapter and
              robot.adapter.client and
              robot.adapter.client.web and
              web = robot.adapter.client.web
        params =
          channel: message.room,
          timestamp: message.id
        setTimeout ->
          web.reactions.remove reaction, params
          .then(
            (response) ->
              if attempt >= 1
                Logger.debug "Removed #{reaction} from #{message} after #{attempt} attempts"
          )
          .catch(
            (err) ->
              attempt += 1
              Logger.removeReaction reaction, message, attempt
          )
        , 1000 * attempt
      else
        @error "Slack web client unavailable"

  Logger
