
chalk = require 'chalk'

if debugEnvStr = process.env.DEBUG
  if typeof debugEnvStr is 'string'
    debugEnvStr = debugEnvStr.toLowerCase()
    DEBUG = debugEnvStr is 'true'
  else
    DEBUG = true
else
  DEBUG = true

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
    @log: (msg) ->
      if msg
        if DEBUG
          console.log(logHeader("[Ibizan] (#{new Date()}) LOG: ") + log("#{msg}"))
        else
          # index = msg.indexOf '\n'
          # if index isnt -1
          #   shortMsg = msg.substring(0, index)
          # else
          #   shortMsg = msg
          # console.log(logHeader("[Ibizan] (Test): ") + log(shortMsg))
    @warn: (msg) ->
      if msg
        if DEBUG
          console.warn(warnHeader("[Ibizan] (#{new Date()}) WARN: ") + warn("#{msg}"))
        else
          # index = msg.indexOf '\n'
          # if index isnt -1
          #   shortMsg = msg.substring(0, index)
          # else
          #   shortMsg = msg
          # console.warn(warnHeader("[Ibizan] (Test): ") + warn(shortMsg))
    @error: (msg, error) ->
      if msg
        if DEBUG
          console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{msg}"), error || '')
        else
          # index = msg.indexOf '\n'
          # if index isnt -1
          #   shortMsg = msg.substring(0, index)
          # else
          #   shortMsg = msg
          # console.error(errHeader("[Ibizan] (Test): ") + err(shortMsg), error || '')
    @fun: (msg) ->
      if msg
        if DEBUG
          console.log(funHeader("[Ibizan] (#{new Date()}) > ") + fun("#{msg}"))
        else
          # index = msg.indexOf '\n'
          # if index isnt -1
          #   shortMsg = msg.substring(0, index)
          # else
          #   shortMsg = msg
          # console.log(funHeader("[Ibizan] (Test): ") + fun(shortMsg))
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
              Logger.errorToSlack response.error
              Logger.logToChannel response.error, user
  Logger
