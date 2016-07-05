
chalk = require 'chalk'

if debugEnvStr = process.env.DEBUG
  if typeof debugEnvStr is 'string'
    debugEnvStr = debugEnvStr.toLowerCase()
    DEBUG = debugEnvStr is 'true'
  else
    DEBUG = false
else
  DEBUG = false

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
    @log: (msg) ->
      if msg
        if DEBUG
          console.log(logHeader("[Ibizan] (#{new Date()}) LOG: ") + log("#{msg}"))
    @warn: (msg) ->
      if msg
        if DEBUG
          console.warn(warnHeader("[Ibizan] (#{new Date()}) WARN: ") + warn("#{msg}"))
    @error: (msg, error) ->
      if msg
        if DEBUG
          console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{msg}"), error || '')
          if error and error.stack
            console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{error.stack}"))
    @fun: (msg) ->
      if msg
        if DEBUG
          console.log(funHeader("[Ibizan] (#{new Date()}) > ") + fun("#{msg}"))
    @logToChannel: (msg, channel) ->
      if msg
        if robot and robot.send?
          robot.send {room: channel}, msg
        else
          Logger.log msg
    @errorToSlack: (msg, error) ->
      if msg
        if robot and robot.send?
          robot.send {room: 'ibizan-diagnostics'},
            "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
        else
          Logger.error msg, error
    @reactToMessage: (reaction, user, channel, slack_ts) ->
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
          client._apiCall 'reactions.add', params, (response) ->
            if not response.ok
              Logger.errorToSlack user, response.error
              Logger.logToChannel "I just tried to react to a message, but
                                   something went wrong. This is usually
                                   the last step in an operation, so your
                                   command probably worked.",
                                  user
  Logger
