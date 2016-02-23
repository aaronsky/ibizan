# Description:
#   Bark with your dog friend
#
# Commands:
#   bark - listens for a bark so it can reply
#
# Author:
#   aaronsky

module.exports = (robot) ->
  Organization = require('../models/organization').get()
  
  robot.hear /bark/i, (res) ->
    res.send "bark bark"

  robot.respond /tell me a joke/i, (res) ->
    res.send "woof"
