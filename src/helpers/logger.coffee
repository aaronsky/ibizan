
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
    @errorToSlack; (msg, error) ->
      if robot
        robot.send {room: 'ibizan-diagnostics'}, "(#{new Date()}) ERROR: #{msg}\n#{error || ''}"
      else
        Logger.error msg, error

  Logger
