# Description:
#   Your dog friend can keep you in line
#
# Commands:
#   ibizan stop ibizan - Disable hounding until the following morning
#   ibizan disable ibizan - See `stop ibizan`
# Notes:
#   Ibizan will DM an employee as soon as they’ve posted in Slack after
#   more than [houndFrequency] hours of inactivity.
#   If the user is logged out, the DM should say:
#     Check in if you’re on the clock~
#   If the user is logged in, the DM should say:
#     Don’t forget to check out~
# Author:
#   aaronsky

moment = require 'moment'
schedule = require 'node-schedule'

{ STRINGS, TIMEZONE } = require '../helpers/constants'
Organization = require('../models/organization').get()
strings = STRINGS.hound

module.exports = (robot) ->
  Logger = require('../helpers/logger')(robot)

  # Generates a random [in/out] hound message
  houndMessage = (mode) ->
    message = ""
    if mode is 'in'
      message += strings.punchin[Math.floor(Math.random() * strings.punchin.length)]
    else if mode is 'out'
      message += strings.punchout[Math.floor(Math.random() * strings.punchout.length)]
    else if mode is 'tempout'
      message += strings.tempout
    if (Math.floor(Math.random() * 6) + 1) == 1
      message += strings.annoying
    return message

  hound = (slackuser, channel, forceHound=false, passive=false) ->
    if robot.name is slackuser.name
      Logger.debug "Caught myself, don't hound the hound."
      return
    else if not Organization.ready()
      Logger.debug "Don't hound, Organization isn't ready yet"
      return

    user = Organization.getUserBySlackName slackuser.name
    if not user
      Logger.debug "#{slackuser.name} couldn't be found while attempting to hound"
      return

    if user.settings.shouldHound and user.settings.houndFrequency > 0
      if not channel.private
        channel.private = !!channel.is_im or !!channel.is_group
      if channel.private or
         channel.name in Organization.exemptChannels
        Logger.debug "##{channel.name} is not an appropriate hounding channel"
        return

      now = moment.tz user.timetable.timezone.name
      last = user.settings?.lastMessage || { time: now, channel: channel.name }
      user.settings?.fromSettings {
        lastMessage: {
          time: now,
          channel: channel.name
        }
      }

      [start, end] = user.activeHours()
      lastPunch = user.lastPunch ['in', 'out', 'vacation', 'sick', 'unpaid']
      lastPing = user.settings?.lastPing || now
      timeSinceStart = +Math.abs(now.diff(start, 'hours', true)).toFixed(2) || 0
      timeSinceEnd = +Math.abs(now.diff(end, 'hours', true)).toFixed(2) || 0
      timeSinceLastPunch = now.diff(lastPunch?.times.slice(-1)[0], 'hours', true) || 0
      timeSinceLastMessage = user
                             .settings?.lastMessage
                             .time.diff(last.time, 'hours', true) || 0
      timeSinceLastPing = +Math.abs(now.diff(lastPing, 'hours', true)) || 0

      Logger.debug "now: #{now.format('h:mm A, z')},
                    isInactive: #{user.isInactive()},
                    start: #{start.format('h:mm A')},
                    end: #{end.format('h:mm A')},
                    timeSinceLastPunch: #{timeSinceLastPunch},
                    timeSinceLastMessage: #{timeSinceLastMessage},
                    timeSinceStart: #{timeSinceStart},
                    timeSinceEnd: #{timeSinceEnd},
                    timeSinceLastPing: #{timeSinceLastPing},
                    houndFrequency: #{user.settings.houndFrequency}"

      if (timeSinceLastPing == 0 or timeSinceLastPing >= user.settings.houndFrequency) and
         timeSinceLastPunch > 0.25
        if user.salary
          if not lastPunch and not user.isInactive() and not passive
            Logger.debug "Considering hounding #{user.slack} because of missing lastPunch during active period"
            if now.isAfter(start) and timeSinceStart >= 0.5
              user.hound houndMessage('in'), Logger
            else if now.isAfter(end) and timeSinceEnd >= 0.5
              user.hound houndMessage('out'), Logger
          else if lastPunch.mode is 'in' and user.isInactive()
            Logger.debug "Considering hounding #{user.slack} because lastPunch is in and it's outside of their active period"
            if timeSinceEnd >= 0.5
              user.hound houndMessage('out'), Logger
          else if lastPunch.mode is 'out' and not passive
            Logger.debug "Considering hounding #{user.slack} because lastPunch is out during active period"
            if not user.isInactive() and timeSinceStart >= 0.5
              user.hound houndMessage('in'), Logger
          else if lastPunch.mode is 'vacation' or
                  lastPunch.mode is 'sick' or
                  lastPunch.mode is 'unpaid'
            Logger.debug "Considering hounding #{user.slack} because lastPunch is special"
            if lastPunch.times.length > 0 and not now.isBetween(lastPunch.times[0], lastPunch.times[1]) and not passive
              user.hound houndMessage('in'), Logger
            else if lastPunch.times.block? and not passive
              endOfBlock = moment(lastPunch.date).add(lastPunch.times.block, 'hours')
              if not now.isBetween(lastPunch.date, endOfBlock)
                user.hound houndMessage('in'), Logger
        else # Part-timer-only hounding
          if lastPunch and lastPunch.mode is 'in' and timeSinceLastPunch > 4
            user.hound houndMessage('tempout'), Logger
      else if timeSinceLastPunch <= 0.25 and user.salary
        Logger.debug "#{user.slack} is safe from hounding as they punched
                      #{timeSinceLastPunch.toFixed(2)} hours ago"
      else
        Logger.debug "#{user.slack} is safe from hounding for another
                      #{user.settings.houndFrequency - timeSinceLastPing.toFixed(2)} hours"

  robot.adapter.client.on 'user_typing', (res) ->
    user = robot.adapter.client.rtm.dataStore.getUserById res.user
    channel = robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById res.channel
    if not channel.name
      channel = { private: null, name: '' }
    hound user, channel, false

  robot.adapter.client.on 'presence_change', (res) ->
    if res.presence is 'active'
      user = robot.adapter.client.rtm.dataStore.getUserById res.user
      hound user, { private: null, name: '' }, false, true

  # Every five minutes, attempt to hound non-salaried users
  autoHoundJob = schedule.scheduleJob '*/5 * * * *', ->
    if not Organization.ready()
      Logger.warn "Don't autohound, Organization isn\'t ready yet"
      return
    for user in Organization.users
      hound { name: user.slack }, { private: null , name: ''}, true, true

  # Every morning, reset hound status for each user
  resetHoundJob = schedule.scheduleJob '0 9 * * 1-5', ->
    if not Organization.ready()
      Logger.warn "Don\'t run scheduled reset, Organization isn\'t ready yet"
      return
    count = Organization.resetHounding()
    response = "Reset #{count}
                #{if count is 1 then "person's" else "peoples'"}
                hound status for the morning"
    Logger.logToChannel response, 'ibizan-diagnostics'

  # Check/adjust hounding settings
  robot.respond /hound\s*(.*)?$/i, id: 'hound.hound', userRequired: true, (res) ->
    user = Organization.getUserBySlackName res.message.user.name

    command = res.match[1]
    if not command
      res.send strings.houndhelp
      Logger.addReaction 'dog2', res.message
      return
    comps = command.split(' ') || []
    scope = comps[0] || 'self'
    if scope is Organization.name
      scope = 'org'
    else if scope is res.message.user.name
      scope = 'self'
    else if scope isnt 'self' and scope isnt 'org'
      if not isNaN(comps[0]) and
         (comps[1] is 'hour' or comps[1] is 'hours')
        comps = ['self', comps.join(' ')]
      else if comps.length > 2
        comps = ['self', comps.slice(1).join(' ')]
      else
        comps = ['self', comps[0]]
      scope = comps[0]
    action = comps[1] || 'unknown'

    if scope is 'self'
      if match = action.match /((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours)/i
        block_str = match[0].replace('hours', '').replace('hour', '').trimRight()
        block = parseFloat block_str
        user.settings.fromSettings {
          houndFrequency: block
        }
        user.directMessage "Hounding frequency set to be every #{block} hours during your active time.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'start' or action is 'on' or action is 'enable'
        user.settings.fromSettings {
          shouldHound: true,
          shouldResetHound: true
        }
        user.directMessage "Hounding is now *on*.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'stop' or action is 'off' or action is 'disable'
        user.settings.fromSettings {
          shouldHound: false,
          shouldResetHound: false
        }
        user.directMessage "Hounding is now *off*. You will not be hounded until you turn this setting back on.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'pause'
        user.settings.fromSettings {
          shouldHound: false,
          shouldResetHound: true
        }
        user.directMessage "Hounding is now *paused*. Hounding will resume tomorrow.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'reset'
        user.settings.fromSettings {
          houndFrequency: Organization.houndFrequency
        }
        user.directMessage "Reset your hounding status to organization defaults *(#{Organization.houndFrequency} hours)*.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'status' or action is 'info'
        status = if user.settings.shouldHound then 'on' else 'off'
        status = if user.settings.shouldResetHound then status else 'disabled'
        if status is 'on'
          status += ", and is set to ping every *#{user.settings.houndFrequency} hours* while active"
        user.directMessage "Hounding is #{status}.", Logger
        Logger.addReaction 'dog2', res.message
      else
        user.directMessage "I couldn't understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`", Logger
        Logger.addReaction 'x', res.message
    else if scope is 'org'
      if not Organization.ready()
        user.directMessage "Organization is not ready", Logger
        Logger.addReaction 'x', res.message
      if match = action.match /((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours)/i
        block_str = match[0].replace('hours', '').replace('hour', '').trimRight()
        block = parseFloat block_str
        Organization.setHoundFrequency(+block.toFixed(2))
        user.directMessage "Hounding frequency set to every #{block} hours for #{Organization.name}, time until next hound reset.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'start' or action is 'enable' or action is 'on'
        Organization.shouldHound = true
        Organization.shouldResetHound = true
        Organization.setShouldHound true
        Organization.setHoundFrequency(+block.toFixed(2))
        user.directMessage "Hounding is now *on* for the organization.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'stop' or action is 'disable' or action is 'off'
        Organization.shouldHound = false
        Organization.shouldResetHound = false
        Organization.setShouldHound false
        user.directMessage "Hounding is now *off* for the organization. Hounding status will not reset until it is reactivated.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'pause'
        Organization.shouldHound = false
        Organization.shouldResetHound = true
        Organization.setShouldHound false
        user.directMessage "Hounding is now *paused* for the organization. Hounding will resume tomorrow.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'reset'
        Organization.resetHounding()
        user.directMessage "Reset hounding status for all #{Organization.name} employees.", Logger
        Logger.addReaction 'dog2', res.message
      else if action is 'status' or action is 'info'
        status = if Organization.shouldHound then 'on' else 'off'
        status = if Organization.shouldResetHound then status else 'disabled'
        if status is 'on'
          status += ", and is set to ping every #{Organization.houndFrequency} hours while active"
        user.directMessage "Hounding is #{status}.", Logger
        Logger.addReaction 'dog2', res.message
      else
        user.directMessage "I couldn't understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`", Logger
        Logger.addReaction 'x', res.message
    else
      Logger.debug "Hound could not parse #{command}"
      user.directMessage "I couldn't understand you. Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`", Logger
      Logger.addReaction 'x', res.message
