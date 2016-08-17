# Description:
#   Bark with your dog friend
#
# Commands:
#
# Author:
#   aaronsky

{ REGEX, STRINGS } = require '../helpers/constants'

moment = require 'moment'
Organization = require('../models/organization').get()
strings = STRINGS.bark

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  robot.hear /bark/i, id: 'bark.bark', (res) ->
    res.send res.random strings.bark

  robot.respond /tell me a story/i, id: 'bark.story', (res) ->
    res.send res.random strings.story

  robot.hear /good (dog|boy|pup|puppy|ibizan|ibi)/i, id: 'bark.goodboy', (res) ->
    res.send strings.goodboy

  robot.respond /fetch\s*(.*)?$/i, id: 'bark.fetch', (res) ->
    thing = res.match[1]
    if not thing
      res.send "_perks up and fidgets impatiently, waiting for @#{res.message.user.name} to `fetch [thing]`_"
    else
      res.send "_runs to fetch #{thing}!_"
      setTimeout ->
        if (Math.floor(Math.random() * 10) + 1) == 1
          res.send "_returns to @#{res.message.user.name}, unable to find #{thing}#{res.random strings.fetchsuffix}_"
        else
          if thing.match(/:(.*?):/g)
            for match in thing.match(/:(.*?):/g)
              Logger.addReaction match.replace(/:/g, ""), res.message
          res.send "_drops #{thing} at @#{res.message.user.name}'s feet#{res.random strings.fetchsuffix}_"
      , 2000 * (Math.floor(Math.random() * 5) + 1)

  robot.router.get '/', (req, res) ->
    res.json {
      'name': process.env.ORG_NAME + '\'s Ibizan',
      'version': process.env.npm_package_version
      'time': moment().format()
    }
