# Description:
#   Your dog friend can keep you in line
#
# Commands:
#   ibizan stop ibizan - Disable hounding until the following morning
#   ibizan disable ibizan - See `stop ibizan`
# Notes:
#
# Author:
#   aaronsky

moment = require 'moment'

Organization = require('../models/organization').get()

module.exports = (robot) ->
  
  Logger = require('../helpers/logger')(robot)

  # Ibizan will DM an employee as soon as they’ve posted in Slack after
  # more than 3 hours of inactivity.
  #   If the user is logged out, the DM should say:
  #     Check in if you’re on the clock~
  #   If the user is logged in, the DM should say:
  #     Don’t forget to check out~

  hound = (slackuser, channel) ->
    if not Organization.ready()
      Logger.log 'Don\'t hound, Organization isn\'t ready yet'
      return
    if robot.name is slackuser.name
      Logger.log 'Caught myself, don\'t hound the hound.'
      return
    user = Organization.getUserBySlackName slackuser.name
    if not user
      Logger.log 'user not found'
      return

    if not channel.private
      channel.private = !!channel.is_im or !!channel.is_group
    
    last = user.lastMessage || moment()
    user.lastMessage = moment()

    if user.isInactive()
      Logger.log 'user is inactive'
    else if not user.shouldHound
      Logger.log 'user is safe from hounding'
    else if channel.private or
            channel.name in Organization.exemptChannels
      Logger.log 'inappropriate channel'
    else if user.lastMessage.diff(last, 'hours', true) < 3
      Logger.log 'user has been recently active'
    else
      if user.punches and user.punches.length > 0 and
         user.punches.slice(-1)[0].mode is 'in'
        robot.send { room: slackuser.name }, "Don't forget to check out~"
      else
        robot.send { room: slackuser.name }, "Check in if you're on the clock~"

  robot.adapter.client.on 'userTyping', (user, channel) -> hound user, channel
  robot.adapter.client.on 'presenceChange', (user, status) ->
    hound user, { private: null, name: '' }

  robot.respond /(stop|disable) ibizan/i, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t disable hounding, Organization isn\'t ready yet'
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      return
    user.shouldHound = false
    res.send 'Ok, I\'ll stop hounding you until tomorrow morning.'
