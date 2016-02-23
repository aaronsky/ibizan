# Description:
#   Bark with your dog friend
#
# Commands:
#   bark - listens for a bark so it can reply
#
# Author:
#   aaronsky

https = require 'https'

Logger = require '../helpers/logger'
Organization = require('../models/organization').get()

module.exports = (robot) ->
  
  robot.hear /bark/i, (res) ->
    res.send "bark bark"

  robot.respond /tell me a story/i, (res) ->
    https.get('https://yepi.io/api/quote', (r) ->
      r.on "data", (chunk) ->
        res.send((chunk + '').trim())
    )
    .on 'error', (err) ->
      Logger.error err
      res.send 'woof woof woof'
