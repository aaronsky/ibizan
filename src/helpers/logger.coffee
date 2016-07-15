
chalk = require 'chalk'
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
    @logToChannel: (msg, channel, attachment) ->
      if msg
        if robot and robot.adapter? and robot.adapter.customMessage?
          message = null
          if attachment and typeIsArray attachment
            message = {
              channel: channel,
              text: msg,
              attachments: attachment
            }
          else if attachment
            message = {
              channel: channel,
              text: msg,
              attachments:
                text: attachment,
                fallback: attachment.replace(/\W/g, '')
            }
          else
            message = {
              channel: channel,
              text: msg
            }
          robot.adapter.customMessage message
        else
          Logger.log msg
    @errorToSlack: (msg, error) ->
      if msg
        if robot and robot.send?
          robot.send {room: 'ibizan-diagnostics'},
            "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
        else
          Logger.error msg, error
    @addReaction: (reaction, message) ->
      if message and
         robot and
         robot.adapter and
         robot.adapter.client and
         robot.adapter.client._apiCall? and
         client = robot.adapter.client
          params =
            name: reaction,
            channel: message.rawMessage.channel,
            timestamp: message.id
          client._apiCall 'reactions.add', params, (response) ->
            if not response.ok
              Logger.errorToSlack message.user.name, response.error
              Logger.logToChannel strings.failedreaction, message.user.name
    @removeReaction: (reaction, message) ->
      if message and
         robot and
         robot.adapter and
         robot.adapter.client and
         robot.adapter.client._apiCall? and
         client = robot.adapter.client
          params =
            name: reaction,
            channel: message.rawMessage.channel,
            timestamp: message.id
          client._apiCall 'reactions.remove', params, (response) ->
            if not response.ok
              # Retry up to 3 times
              retry = 1
              setTimeout ->
                if retry <= 3
                  Logger.debug "Retrying removal of #{reaction}, attempt #{retry}..."
                  client._apiCall 'reactions.remove', params, (response) ->
                    if response.ok
                      Logger.debug "#{reaction} removed successfully"
                      return true
                  retry += 1
                else
                  Logger.errorToSlack message.user.name, response.error
                  Logger.logToChannel strings.failedreaction, message.user.name
              , 1000
  Logger
