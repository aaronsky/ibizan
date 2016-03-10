
module.exports = (robot) ->
  class Logger
    constructor: () ->
    @log: (msg) ->
      console.log "[Ibizan] (#{new Date()}) LOG: #{msg}"
    @warn: (msg) ->
      console.warn "[Ibizan] (#{new Date()}) WARN: #{msg}"
    @error: (msg, error) ->
      console.error "[Ibizan] (#{new Date()}) ERROR: #{msg}", error || ''
    @logToChannel: (msg, channel) ->
      if robot
        robot.send {room: channel}, msg
      else
        Logger.log msg
    @errorToSlack: (msg, error) ->
      if robot
        robot.send {room: 'ibizan-diagnostics'},
         "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
      else
        Logger.error msg, error
    @reactToMessage: (reaction, user, channel, slack_ts) ->
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
