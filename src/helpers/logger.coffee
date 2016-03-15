
if debugEnvStr = process.env.DEBUG
  if typeof debugEnvStr is 'string'
    debugEnvStr = debugEnvStr.toLowerCase()
    DEBUG = debugEnvStr is 'true'
  else
    DEBUG = true
else
  DEBUG = true
console.log DEBUG

module.exports = (robot) ->
  class Logger
    constructor: () ->
    @log: (msg) ->
      if DEBUG
        console.log "[Ibizan] (#{new Date()}) LOG: #{msg}"
    @warn: (msg) ->
      if DEBUG
        console.warn "[Ibizan] (#{new Date()}) WARN: #{msg}"
    @error: (msg, error) ->
      if DEBUG
        console.error "[Ibizan] (#{new Date()}) ERROR: #{msg}", error || ''
    @logToChannel: (msg, channel) ->
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
