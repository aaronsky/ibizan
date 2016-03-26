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
schedule = require 'node-schedule'

TIMEZONE = require('../helpers/constants').TIMEZONE
Organization = require('../models/organization').get()

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  # Ibizan will DM an employee as soon as they’ve posted in Slack after
  # more than 3 hours of inactivity.
  #   If the user is logged out, the DM should say:
  #     Check in if you’re on the clock~
  #   If the user is logged in, the DM should say:
  #     Don’t forget to check out~

  hound = (slackuser, channel, forceHound=false) ->
    if not channel.private
      channel.private = !!channel.is_im or !!channel.is_group
    if not Organization.ready()
      Logger.log 'Don\'t hound, Organization isn\'t ready yet'
      return
    else if channel.private or
            channel.name in Organization.exemptChannels
      Logger.log "##{channel.name} is not an appropriate hounding channel"
      return
    else if robot.name is slackuser.name
      Logger.log 'Caught myself, don\'t hound the hound.'
      return

    user = Organization.getUserBySlackName slackuser.name
    if not user
      Logger.log 'user not found'
      return
    
    now = moment.tz TIMEZONE
    last = user.lastMessage || { time: now, channel: channel.name }
    user.lastMessage = {
      time: now,
      channel: channel.name,
      lastPing: last.lastPing
    }

    timeSinceLastMessage = user.lastMessage.time.diff last.time, 'hours', true
    timeSinceLastPing = user
                        .lastMessage
                        .lastPing?.diff(last.lastPing, 'hours', true) || 0
    lastPunch = user.lastPunch 'in', 'out'
    timeSinceLastPunch = now.diff(lastPunch?.times.slice(-1)[0], 'hours', true) || 0

    if not user.shouldHound
      Logger.log 'User is safe from hounding'
      if timeSinceLastPing > 1
        user.shouldHound = true
      return

    if timeSinceLastMessage >= 3 or timeSinceLastPunch >= 3 or forceHound
      if lastPunch.mode is 'in'
        user.directMessage "Don't forget to check out~", Logger
        user.shouldHound = false
        user.lastMessage.lastPing = now
      else if not user.isInactive()
        user.directMessage "Check in if you're on the clock~", Logger
        user.shouldHound = false
        user.lastMessage.lastPing = now
    else
      status = "#{user.slack} was active "
      if last.channel
        status += "in ##{last.channel} "
      status += "recently (#{last.time.format('MMM Do, YYYY h:mma')})"
      Logger.log status

  robot.adapter.client.on 'userTyping', (user, channel) ->
    hound user, channel
  robot.adapter.client.on 'presenceChange', (user, status) ->
    hound user, { private: null, name: '' }

  # Every morning, reset hound status for each users
  houndJob = schedule.scheduleJob '*/5 * * * *', ->
    if not Organization.ready()
      Logger.log "Don\'t run scheduled reset, Organization isn\'t ready yet"
      return
    for user in Organization.users
      hound { name: user.slack}, { private: null , name: ''}, true


  # Every morning, reset hound status for each users
  resetHoundJob = schedule.scheduleJob '0 6 * * 1-5', ->
    if not Organization.ready()
      Logger.log "Don\'t run scheduled reset, Organization isn\'t ready yet"
      return
    count = Organization.resetHounding()
    response = "Reset #{count}
                #{if count is 1 then "person's" else "peoples'"}
                hound status for the morning"
    Logger.logToChannel response, 'ibizan-diagnostics'

  robot.respond /(stop|disable) ibizan/i, (res) ->
    if not Organization.ready()
      Logger.log 'Don\'t disable hounding, Organization isn\'t ready yet'
      return
    user = Organization.getUserBySlackName res.message.user.name
    if not user
      return
    user.shouldHound = false
    res.send 'Ok, I\'ll stop hounding you until tomorrow morning.'