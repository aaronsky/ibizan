export function applyReceiveMiddleware(controller: botkit.Controller) {
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
            message.user = user;
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
            message.channel = channel;
            next();
        });
    }

    controller.middleware.receive.use(onReceiveSetChannel);
    controller.middleware.receive.use(onReceiveSetUser);
}