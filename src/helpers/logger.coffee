
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
      if DEBUG
        console.log(logHeader("[Ibizan] (#{new Date()}) LOG: ") + log("#{msg}"))
    @warn: (msg) ->
      if DEBUG
        console.warn(warnHeader("[Ibizan] (#{new Date()}) WARN: ") + warn("#{msg}"))
    @error: (msg, error) ->
      if DEBUG
        console.error(errHeader("[Ibizan] (#{new Date()}) ERROR: ") + err("#{msg}"), error || '')
    @fun: (msg) ->
      if DEBUG
        console.log(funHeader("[Ibizan] (#{new Date()}) > ") + fun("#{msg}"))
    @logToChannel: (msg, channel, ephemeral) ->
      if DEBUG
        if robot
          robot.send {room: channel}, msg
        else
          Logger.log msg
    @errorToSlack: (msg, error) ->
      if DEBUG
        if robot
          robot.send {room: 'ibizan-diagnostics'},
            "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
        else
          Logger.error msg, error
    @reactToMessage: (reaction, user, channel, slack_ts) ->
      if DEBUG
        if robot and
           robot.adapter and
           client = robot.adapter.client
          params =
            name: reaction,
            channel: channel,
            timestamp: slack_ts
          client._apiCall 'reactions.add', params, (response) ->
            if not response.ok
              Logger.logToChannel response.error, user
  Logger
