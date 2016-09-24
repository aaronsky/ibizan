# Description:
#   Bark with your dog friend
#
# Commands:
#
# Author:
#   aaronsky

module.exports = (robot) ->

  robot.hear /bark/i, (res) ->
    res.send "bark bark"

  robot.respond /tell me a story/i, (res) ->
    res.send 'woof woof woof'

  robot.hear /good (dog|boy|pup|puppy|ibizan|ibi)/i, (res) ->
    res.send ':ok_hand:'