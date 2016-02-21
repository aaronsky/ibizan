moment = require 'moment'
Logger = require '../helpers/logger'
Organization = require('../models/organization').get()

module.exports = (robot) ->
  # Ibizan will DM an employee as soon as they’ve posted in Slack after
  # more than 3 hours of inactivity.
  #   If the user is logged out, the DM should say:
  #     Check in if you’re on the clock~
  #   If the user is logged in, the DM should say:
  #     Don’t forget to check out~

  hound = (user, slack) ->
    now = moment()
    Logger.log 'hounding'
    Logger.log slack
    presence = slack.getPresence (res) ->
      if res.ok
        lastActivity = moment(res.lastActivity)
        if now.diff(lastActivity, 'hours') >= 3
          robot.sendMessage 'NO'


  robot.adapter.client.on 'userTyping', (slackuser, channel) ->
    if not channel.private
      channel.private = !!channel.is_im or !!channel.is_group
    user = Organization.getUserBySlackName slackuser.name

    if not user
      Logger.log 'user not found'
      return
    else if user.isInactive()
      Logger.log 'user is inactive'
      return
    else if not user.shouldHound
      Logger.log 'user is safe from hounding'
      return
    else if channel.private or
            channel.name in Organization.exemptChannels
      Logger.log 'inappropriate channel'
      return
    else
      # hound user, slackuser

  robot.respond /(stop|disable) ibizan/i, (res) ->
    user = Organization.getUserBySlackName(res.message.user.name)
    if not user
      return
    user.shouldHound = false
    res.send 'Ok, I\'ll stop hounding you until tomorrow morning.'
