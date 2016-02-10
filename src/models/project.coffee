class Project
  constructor: (@name = '', @start, @total) ->
    @name = @name.replace '#', ''

module.exports = Project