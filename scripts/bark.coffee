# Description:
#   Bark with your dog friend
#
# Commands:
#   bark - listens for a bark so it can reply
#
# Author:
#   aaronsky

module.exports = (robot) ->
  Organization = require('./src/organization').get()
  
  robot.hear /bark/i, (res) ->
    res.send "Bark Bark"
  robot.hear /!list users/i, (res) ->
    res.send JSON.stringify Organization.users