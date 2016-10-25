// Description:
//   Your dog friend guards access to your most prized commands
//
// Commands:
//
// Author:
//   bcoia

import { REGEX, STRINGS } from '../shared/constants';
const strings = STRINGS.access;
import Logger from '../logger';

import { Organization as Org } from '../models/organization';
const Organization = Org.get();

export default function (controller) {
  Logger.Slack.setController(controller);

  function isAdminUser(userName: string) {
    return process.env.ADMINS.split(' ').indexOf(userName) !== -1;
  }

  controller.middleware.receive.use(function (bot, message, next) {
    /*
    command = context.listener.options.id
    message = context.response.message
    username = context.response.message.user.name
    if username is 'hubot' or username is 'ibizan'
      # Ignore myself and messages overheard
      done()
    else if command is null
      # Ignore unknown commands or catch-alls
      next()
    else
      if not Organization.ready()
        # Organization is not ready, ignore command
        context.response.send strings.orgnotready
        Logger.addReaction 'x', message
        done()
      else
        Logger.log "Responding to '#{message}' (#{command}) from #{username}"
        if context.listener.options.adminOnly
          if not isAdminUser username
            # Admin command, but user isn't in whitelist
            context.response.send strings.adminonly
            Logger.addReaction 'x', message
            done()
        if context.listener.options.userRequired
          user = Organization.getUserBySlackName username
          if not user
            # Slack user does not exist in Employee sheet, but user is required
            context.response.send strings.notanemployee
            Logger.addReaction 'x', message
            done()
        # All checks passed, continue
        next(done)
    */
  });

  // Catch-all for unrecognized commands
  controller.on('message_received', function(bot, message) {
    if (message && message.text && message.text.length < 30 && (message.text.match(REGEX.ibizan) || message.room && message.room.substring(0, 1) === 'D')) {
      bot.reply(`_${bot.random(strings.unknowncommand)} ${bot.random(strings.askforhelp)}_`);
      Logger.Slack.addReaction('question', message);
      bot.finish();
    }
  });
};