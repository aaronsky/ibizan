class Logger
  constructor: () ->
  @log: (msg) ->
    console.log "[Ibizan] (#{new Date()}) LOG: #{msg}"
  @warn: (msg) ->
    console.warn "[Ibizan] (#{new Date()}) WARN: #{msg}"
  @error: (msg, error) ->
    console.error "[Ibizan] (#{new Date()}) ERROR: #{msg}", error || ''

module.exports = Logger