Organization = require('../models/organization').get()

module.exports = (robot) ->
  # Ibizan will DM an employee as soon as they’ve posted in Slack after more than 3 hours of inactivity.
  #   If the user is logged out, the DM should say: Check in if you’re on the clock~
  #   If the user is logged in, the DM should say: Don’t forget to check out~

  hound = (user) ->
    now = moment()
    console.log 'hounding'
    console.log user
    presence = user.getPresence (res) ->
      if res.ok
        lastActivity = moment(res.lastActivity)
        if now.diff(lastActivity, 'hours') >= 3
          robot.sendMessage 'NO'


  robot.adapter.client.on 'userTyping', (user, channel) ->
    res =
      user:
        id: user.id
        name: user.name
        real_name: user.real_name || user.name
      channel:
        id: channel.id
        name: channel.name
        private: !!channel.is_im || !!channel.is_group
    user = Organization.getUserBySlackName(res.user.name)
    if not user
      console.log 'user not found'
      return
    else if user.isInactive()
      console.log 'user is inactive'
      return
    else if not user.shouldHound
      console.log 'user is safe from hounding'
      return
    else if res.channel.private or
            res.channel.name in Organization.exemptChannels
      console.log 'inappropriate channel'
      return
    else
      hound user

  robot.respond /(stop|disable) ibizan/i, (res) ->
    user = Organization.getUserBySlackName(res.message.user.name)
    if not user
      return
    user.shouldHound = false
    res.send 'Ok, I\'ll stop hounding you until tomorrow morning.'
