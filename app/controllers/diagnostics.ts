// Description:
//   Your dog friend makes sure everything's in order
//
// Commands:
//
// Notes:
//
// Author:
//   aaronsky

import * as moment from 'moment';

import { EVENTS, TIMEZONE } from '../shared/constants';
import { Message } from '../shared/common';
import { Slack } from '../logger';
import { Organization } from '../models/organization';
import { buildOptions } from '../middleware/access';

function onUptimeHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    bot.reply(message, message.copy.diagnostics.uptime(organization.name, organization.initTime.toDate(), +moment().diff(organization.initTime, 'minutes', true).toFixed(2)));
    Slack.addReaction('dog2', message);
}

function onUsersListHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    const attachments = organization.users.map(user => user.slackAttachment());
    user.directMessage(message.copy.diagnostics.users, attachments);
    Slack.addReaction('dog2', message);
}

function onUserHelpHandler(bot, message: Message) {
    bot.reply(message, message.copy.diagnostics.userHelp);
    Slack.addReaction('dog2', message);
}

function onUserDetailHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const requestingUser = organization.getUserBySlackName(message.user_obj.name);
    const queryedUser = organization.getUserBySlackName(message.match[1]);
    const response = message.copy.diagnostics.user(message.match[1], !!queryedUser);
    if (queryedUser) {
        requestingUser.directMessage(response, [queryedUser.slackAttachment()]);
        Slack.addReaction('dog2', message);
    } else {
        requestingUser.directMessage(response);
        Slack.addReaction('x', message);
    }
}

async function onDailyReportHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const yesterday = moment.tz({
        hour: 0,
        minute: 0,
        second: 0
    }, TIMEZONE).subtract(1, 'days');
    const today = moment.tz({
        hour: 0,
        minute: 0,
        second: 0
    }, TIMEZONE);
    try {
        const reports = await organization.generateReport(yesterday, today);
        if (typeof reports !== 'number') {
            const report = organization.dailyReport(reports, today, yesterday);
            bot.reply(message, report);
        }
    } catch (err) {
        Slack.error('Failed to produce a daily report', err);
    }
    Slack.addReaction('dog2', message);
}

function onProjectsListHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    const response = message.copy.diagnostics.projects;
    const attachments = organization.projects.map(project => project.slackAttachment());
    user.directMessage(response, attachments);
    Slack.addReaction('dog2', message);
}

function onCalendarHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    const attachment = [organization.calendar.slackAttachment()];
    user.directMessage(message.copy.diagnostics.calendar, attachment);
    Slack.addReaction('dog2', message);
}

async function onSyncHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    Slack.addReaction('clock4', message);
    try {
        const status = await organization.sync();
        bot.reply(message, message.copy.diagnostics.syncSuccess);
        Slack.removeReaction('clock4', message);
        Slack.addReaction('dog2', message);
    } catch (err) {
        Slack.error(message.copy.diagnostics.syncFailed, err);
        Slack.removeReaction('clock4', message);
        Slack.addReaction('x', message);
    }
}

function onHelpHandler(bot, message: Message) {
    const organization: Organization = message.organization;
    if (!organization) {
        console.error('No Organization was found for the team: ' + bot);
        return;
    }
    const user = organization.getUserBySlackName(message.user_obj.name);
    user.directMessage(message.copy.diagnostics.help);
    Slack.addReaction('dog2', message);
}


export default function (controller: botkit.Controller) {
    // respond
    // diagnostics.uptime, 
    controller.hears('uptime',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.uptime' }, controller),
        onUptimeHandler);

    // respond
    // id: diagnostics.users, userRequired: true, adminOnly: true
    controller.hears('users',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.users', userRequired: true, adminOnly: true }, controller),
        onUsersListHandler);

    // respond
    // id: diagnostics.userHelp, adminOnly: true
    controller.hears('user$',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.userHelp', adminOnly: true }, controller),
        onUserHelpHandler);

    // respond
    // id: diagnostics.user, userRequired: true, adminOnly: true
    controller.hears('user (.*)',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.user', userRequired: true, adminOnly: true }, controller),
        onUserDetailHandler);

    // respond
    // id: diagnostics.dailyReport, adminOnly: true
    controller.hears('daily report',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.dailyReport', adminOnly: true }, controller),
        onDailyReportHandler);

    // respond
    // id: diagnostics.projects, userRequired: true, adminOnly: true
    controller.hears('projects',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.projects', userRequired: true, adminOnly: true }, controller),
        onProjectsListHandler);

    // respond
    // id: diagnostics.calendar, userRequired: true, adminOnly: true
    controller.hears('calendar',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.calendar', userRequired: true, adminOnly: true }, controller),
        onCalendarHandler);

    // respond
    // diagnostics.sync
    controller.hears('sync',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.sync' }, controller),
        onSyncHandler);

    // respond
    // diagnostics.help
    controller.hears('.*(help|docs|documentation|commands).*',
        EVENTS.respond,
        buildOptions({ id: 'diagnostics.help' }, controller),
        onHelpHandler);

    return controller;
};