Organization = require('../models/organization').get()

module.exports = (robot) ->
  robot.adapter.client.on 'userTyping', (user, channel) ->
    res = 
      user:
        id: user.id
        name: user.name
        real_name: user.real_name || user.name
      channel:
        id: channel.id
        name: channel.name
        dm: !!channel.is_im
    user = Organization.getUserBySlackName(res.user.name)
    if not user
      return
    else if user.isInactive()
      return
    else if not user.shouldHound
      return
    else if res.channel.name in Organization.exemptChannels
      return
    # else send message

  robot.respond /(stop|disable) ibizan/i, (res) ->
    user = Organization.getUserBySlackName(res.message.user.name)
    if not user
      return
    user.shouldHound = false
    res.send 'Ok, I\'ll stop hounding you until tomorrow ;)'