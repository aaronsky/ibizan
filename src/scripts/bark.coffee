# Description:
#   Bark with your dog friend
#
# Commands:
#
# Author:
#   aaronsky

moment = require 'moment'
Organization = require('../models/organization').get()
barkResponses = ['bark', 'bark bark', 'bark bark bark']

module.exports = (robot) ->

  Logger = require('../helpers/logger')(robot)

  robot.hear /bark/i, (res) ->
    res.send res.random barkResponses

  robot.respond /tell me a story/i, (res) ->
    res.send 'woof woof woof'

  robot.hear /good (dog|boy|pup|puppy|ibizan|ibi)/i, (res) ->
    res.send ':ok_hand:'

  robot.router.get '/', (req, res) ->
    res.json {
      'name': process.env.ORG_NAME + '\'s Ibizan',
      'time': moment().format()
    }