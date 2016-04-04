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
      Logger.warn 'Don\'t hound, Organization isn\'t ready yet'
      return
    else if channel.private or
            channel.name in Organization.exemptChannels
      Logger.warn "##{channel.name} is not an appropriate hounding channel"
      return
    else if robot.name is slackuser.name
      Logger.log 'Caught myself, don\'t hound the hound.'
      return

    user = Organization.getUserBySlackName slackuser.name
    if not user
      Logger.log "#{slackuser.name} couldn't be found while attempting to hound"
      return
    
    now = moment.tz TIMEZONE
    last = user.settings?.lastMessage || { time: now, channel: channel.name }
    user.settings?.fromSettings {
      lastMessage: {
        time: now,
        channel: channel.name,
        lastPing: last.lastPing
      }
    }

    timeSinceLastMessage = user
                            .settings?.lastMessage
                            .time.diff last.time, 'hours', true
    timeSinceLastPing = user
                        .settings?.lastMessage
                        .lastPing?.diff(last.lastPing, 'hours', true) || 0
    lastPunch = user.lastPunch 'in', 'out'
    timeSinceLastPunch = now.diff(lastPunch?.times.slice(-1)[0], 'hours', true) || 0

    if not user.shouldHound
      qualifier = ''
      if timeSinceLastPing > 1
        user.shouldHound = true
        qualifier = "for another #{timeSinceLastPing} hours"
      Logger.log "#{user.slack} is safe from hounding#{qualifier}"
      return

    if (timeSinceLastMessage >= 3 or forceHound) and timeSinceLastPunch >= 3
      if lastPunch?.mode is 'in'
        user.directMessage "Don't forget to check out~", Logger
        user.shouldHound = false
        user.settings?.lastMessage.lastPing = now
      else if not user.isInactive()
        user.directMessage "Check in if you're on the clock~", Logger
        user.shouldHound = false
        user.settings?.lastMessage.lastPing = now
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
      Logger.warn "Don\'t run scheduled reset, Organization isn\'t ready yet"
      return
    for user in Organization.users
      hound { name: user.slack}, { private: null , name: ''}, true


  # Every morning, reset hound status for each users
  resetHoundJob = schedule.scheduleJob '0 6 * * 1-5', ->
    if not Organization.ready()
      Logger.warn "Don\'t run scheduled reset, Organization isn\'t ready yet"
      return
    count = Organization.resetHounding()
    response = "Reset #{count}
                #{if count is 1 then "person's" else "peoples'"}
                hound status for the morning"
    Logger.logToChannel response, 'ibizan-diagnostics'

  robot.router.post '/ibizan/hound', (req, res) ->
    body = req.body
    if body.token is process.env.SLASH_HOUND_TOKEN
      comps = body.text || []
      scope = comps[0] || 'self'
      if scope is Organization.name
        scope = 'org'
      else if scope is body.user_name
        scope = 'self'
      action = comps[1].splice() || 'info'

      if scope is 'self'
        user = Organization.getUserBySlackName body.user_name
        if not user
          # TODO: Improve output
          err = "User not found"
        else if match = action.match /((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours))/i
          block_str = match[0].replace('hours', '').replace('hour', '').trimRight()
          block = parseFloat block_str
          user.settings.fromSettings {
            houndFrequency: block
          }
          response = "Hounding frequency set to be every #{block} hours during your active time."
        else if action is 'start'
          user.settings.fromSettings {
            shouldHound: true,
            shouldResetHound: true
          }
          response = "Hounding is on."
        else if action is 'stop'
          user.settings.fromSettings {
            shouldHound: false
          }
          response = "Hounding is off for the rest of today."
        else if action is 'enable'
          user.settings.fromSettings {
            shouldHound: true,
            shouldResetHound: true
          }
          response = "Enabled hounding."
        else if action is 'disable'
          user.settings.fromSettings {
            shouldHound: false,
            shouldResetHound: false
          }
          response = "Disabled hounding. You will not be hounded until you turn this setting back on."
        else if action is 'reset'
          user.resetHounding Organization.houndFrequency
          response = "Reset your hounding status to organization defaults (#{Organization.houndFrequency} hours)."
        else
          status = if user.settings.shouldHound then 'on' else 'off'
          status = if user.settings.shouldResetHound then status else 'disabled'
          if status is 'on'
            status += ", and is set to ping every #{user.settings.houndFrequency} hours while active"
          response = "Hounding is #{status}."
      else if scope is 'org'
        if match = action.match /((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours))/i
          block_str = match[0].replace('hours', '').replace('hour', '').trimRight()
          block = parseFloat block_str
          Organization.setHoundFrequency(+block.toFixed(2))
          response = "Hounding frequency set to every #{block} hours for #{Organization.name}, time until next hound reset."
        else if action is 'start'
          Organization.shouldHound = true
          Organization.shouldResetHound = true
          response = "Hounding is on for the organization."
        else if action is 'stop'
          Organization.shouldHound = false
          response = "Hounding is off for the organization."
        else if action is 'enable'
          Organization.shouldHound = true
          Organization.shouldResetHound = true
          response = "Enabled hounding for #{Organization.name}."
        else if action is 'disable'
          Organization.shouldHound = false
          Organization.shouldResetHound = false
          response = "Disabled hounding for #{Organization.name}."
        else if action is 'reset'
          Organization.resetHounding()
          response = "Reset hounding status for all #{Organization.name} employees."
        else
          status = if Organization.shouldHound then 'on' else 'off'
          status = if Organization.shouldResetHound then status else 'disabled'
          if status is 'on'
            status += ", and is set to ping every #{Organization.houndFrequency} hours while active"
          response = "Hounding is #{status}."
      res.status 200
      count = Organization.resetHounding()
      response = "Reset #{count}
                  #{if count is 1 then "person's" else "peoples'"}
                  hound status"
    else
      res.status 401
      response = "Bad token in Ibizan configuration"
    res.json {
      "text": response
    }