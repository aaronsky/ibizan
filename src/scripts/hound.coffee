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

  hound = (slackuser, channel) ->
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

    if not channel.private
      channel.private = !!channel.is_im or !!channel.is_group
    
    now = moment.tz TIMEZONE
    last = user.lastMessage || { time: now, channel: channel.name, lastPing: null }
    user.lastMessage = { time: now, channel: channel.name, lastPing: null }

    timeSinceLastMessage = user.lastMessage.time.diff last.time, 'hours', true
    timeSinceLastPing = user.lastMessage.lastPing?.diff(last.lastPing, 'hours', true) || 0

    if timeSinceLastMessage < 3
      Logger.log "#{user.slack} was active
                 #{if last.channel then "in ##{last.channel} " else ''}recently
                 (#{last.time.format('MMM Do, YYYY h:mma')})"
      return

    if not user.shouldHound
      Logger.log 'User is safe from hounding'
      if timeSinceLastPing > 1
        user.shouldHound = true
      return

    if user.punches and user.punches.length > 0 and
       user.punches.slice(-1)[0].mode is 'in'
      robot.send { room: slackuser.name }, "Don't forget to check out~"
      user.shouldHound = false
      user.lastMessage.lastPing = now
    else
      robot.send { room: slackuser.name }, "Check in if you're on the clock~"
      user.shouldHound = false
      user.lastMessage.lastPing = now


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
      hound { name: user.slack}, { private: null , name: ''}


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