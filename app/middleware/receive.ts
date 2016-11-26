import { Slack } from '../logger';

export function applyReceiveMiddleware(controller: botkit.Controller) {
    function onReceiveSetSlackLoggerBot(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        Slack.setBot(bot);
        next();
    }

    function onReceiveSetUser(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        if (!message.user) {
            next();
            return;
        }
        bot.api.users.info({ user: message.user }, (err, data) => {
            if (!data.ok) {
                next();
                return;
            }
            const { user } = data;
            message.user_obj = user;
            next();
        });
    }

    function onReceiveSetChannel(bot: botkit.Bot, message: botkit.Message, next: () => void) {
        if (!message.channel) {
            next();
            return;
        }
        bot.api.channels.info({ channel: message.channel }, (err, data) => {
            if (!data.ok) {
                next();
                return;
            }
            const { channel } = data;
            message.channel_obj = channel;
            next();
        });
    }

    controller.middleware.receive.use(onReceiveSetSlackLoggerBot);
    controller.middleware.receive.use(onReceiveSetChannel);
    controller.middleware.receive.use(onReceiveSetUser);
}