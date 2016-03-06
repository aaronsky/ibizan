# Description:
#   Bark with your dog friend
#
# Commands:
#
# Author:
#   aaronsky

https = require 'https'

Organization = require('../models/organization').get()

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)

  robot.hear /bark/i, (res) ->
    res.send "bark bark"

  robot.respond /tell me a story/i, (res) ->
    res.send 'woof woof woof'

  robot.hear /good dog/i, (res) ->
    res.send ':+1: :dog: :+1:'