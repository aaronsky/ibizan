
chalk = require 'chalk'

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
          response = "Something went wrong on Google's end and the
                     operation couldn't be completed. Please try again
                     in a minute. If this persists for longer than 5 minutes,
                     DM a maintainer ASAP."
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
          console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{error.stack}"))
    @fun: (msg) ->
      if msg
        console.log(funHeader("[Ibizan] (#{new Date()}) > ") + fun("#{msg}"))
    @logToChannel: (msg, channel) ->
      if msg
        if robot and robot.send?
          attachment = {
            channel: channel,
            text: msg
          }
          robot.adapter.customMessage attachment
        else
          Logger.log msg
    @errorToSlack: (msg, error) ->
      if msg
        if robot and robot.send?
          robot.send {room: 'ibizan-diagnostics'},
            "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
        else
          Logger.error msg, error
    @reactToMessage: (reaction, user, channel, slack_ts, command) ->
      if reaction and
         channel and
         slack_ts
        if robot and
           robot.adapter and
           robot.adapter.client._apiCall? and
           client = robot.adapter.client
          params =
            name: reaction,
            channel: channel,
            timestamp: slack_ts
          api_command = command || 'reactions.add'
          client._apiCall api_command, params, (response) ->
            if not response.ok
              Logger.errorToSlack user, response.error
              Logger.logToChannel "I just tried to react to a message, but
                                   something went wrong. This is usually
                                   the last step in an operation, so your
                                   command probably worked.",
                                  user
  Logger
