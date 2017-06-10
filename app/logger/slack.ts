import {
    Message,
    SlackUser,
    SlackChannel,
    typeIsArray
} from '../shared/common';

export namespace SlackLogger {
    let bot: botkit.Bot;

    export function setBot(newBot: botkit.Bot) {
        bot = newBot;
    }

    function composeMessage(text: string, channel: string, attachment?: string | { text: string, fallback: string }[]) {
        const message: any = {
            text,
            channel,
            parse: 'full',
            username: 'ibizan',
            attachments: null
        };

        if (typeof attachment === 'string') {
            message.attachments = {
                text: attachment,
                fallback: attachment.replace(/\W/g, '')
            };
        } else if (attachment) {
            message.attachments = attachment;
        }

        return message;
    }

    export async function getUser(id: string) {
        return new Promise<SlackUser>((resolve, reject) => {
            bot.api.users.info({ user: id }, (err, response: SlackUser) => {
                if (err || (response && !response.ok)) {
                    reject(err);
                    return;
                }
                resolve(response.user);
            });
        });
    }

    export async function getChannel(id: string) {
        return new Promise<SlackChannel>((resolve, reject) => {
            bot.api.channels.info({ channel: id }, (err, response: SlackChannel) => {
                if (err || (response && !response.ok)) {
                    reject(err);
                    return;
                }
                resolve(response.channel);
            });
        });
    }

    async function joinChannel(name: string) {
        return new Promise<SlackChannel>((resolve, reject) => {
            bot.api.channels.join({ name: 'ibizan-diagnostics' }, (err, response: SlackChannel) => {
                if (err || (response && !response.ok)) {
                    reject(err);
                    return;
                }
                resolve(response.channel);
            });
        });
    }

    export async function imList() {
        return new Promise<any[]>((resolve, reject) => {
            bot.api.im.list({}, async (err, response) => {
                if (err || (response && !response.ok)) {
                    reject(err);
                    return;
                }
                resolve(response.ims);
            });
        });
    }

    export function log(text: string, channel: string, attachment?: string | { text: string, fallback: string }[]) {
        if (!text) {
            console.error('No text passed to log function');
            return
        } else if (!bot) {
            console.error(`No robot available to send message: ${text}`);
            return;
        }
        const message = composeMessage(text, channel, attachment);
        bot.send(message, (err) => { });
    }

    export function logDM(text: string, id: string, attachment?: string | { text: string, fallback: string }[]) {
        if (bot && text && id) {
            bot.api.im.open({ user: id }, (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                const message = composeMessage(text, data.channel.id, attachment);
                bot.send(message, (err) => { });
            });
        }
    }

    export function error(text: string, error?: any) {
        if (!text) {
            console.error('SlackLogger#error called with no message');
            return;
        }
        bot.api.channels.list({}, async (err, data) => {
            if (err || (data && !data.ok)) {
                console.error(err);
                return;
            }
            const channels: SlackChannel[] = data.channels;
            channels.some(channel => {
                if (channel.name !== 'ibizan-diagnostics') {
                    return false;
                }
                const message = composeMessage(`(${new Date()}) ERROR: ${text}\n${error || ''}`, channel.id);
                bot.send(message, err => { });
                return true;
            });
            try {
                const channel = await joinChannel('ibizan-diagnostics');
                const message = composeMessage(`(${new Date()}) ERROR: ${text}\n${error || ''}`, channel.id);
                bot.send(message, err => { });
            } catch (error) {
                console.error(error);
            }
        });
    }

    export function reactTo(message: Message, reaction: string, attempt: number = 0) {
        if (attempt > 0 && attempt <= 2) {
            console.debug(`Retrying adding ${reaction}, attempt ${attempt}...`);
        }
        if (attempt >= 3) {
            console.error(`Failed to add ${reaction} to ${message} after ${attempt} attempts`);
            log(message.copy.logger.failedReaction, message.user_obj.name);
        } else if (bot && reaction && message) {
            const payload = {
                timestamp: message.ts,
                channel: message.channel,
                name: reaction
            };
            setTimeout(() => {
                bot.api.reactions.add(payload, (err, data) => {
                    if (err || (data && !data.ok)) {
                        attempt += 1;
                        reactTo(message, reaction, attempt);
                    } else {
                        if (attempt >= 1) {
                            console.debug(`Added ${reaction} to ${message} after ${attempt} attempts`);
                        }
                    }
                });
            }, 1000 * attempt);
        } else {
            console.error('Slack web client unavailable');
        }
    }

    export function unreact(message: Message, reaction: string, attempt: number = 0) {
        if (attempt > 0 && attempt <= 2) {
            console.debug(`Retrying removal of ${reaction}, attempt ${attempt}...`);
        }
        if (attempt >= 3) {
            console.error(`Failed to remove ${reaction} from ${message} after ${attempt} attempts`);
            log(message.copy.logger.failedReaction, message.user_obj.name);
        } else if (bot && reaction && message) {
            const payload = {
                timestamp: message.ts,
                channel: message.channel,
                name: reaction
            };
            setTimeout(() => {
                bot.api.reactions.remove(payload, (err, data) => {
                    if (err || (data && !data.ok)) {
                        attempt += 1;
                        unreact(message, reaction, attempt);
                    } else {
                        if (attempt >= 1) {
                            console.debug(`Removed ${reaction} from ${message} after ${attempt} attempts`);
                        }
                    }
                });
            }, 1000 * attempt);
        } else {
            console.error('Slack web client unavailable');
        }
    }
}