// Description:
//   Your dog friend onboards new users and teams
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
import { Console, Slack } from '../logger';
import { TeamConfig } from '../config';
import { Organization } from '../models/organization';
import { buildOptions } from '../middleware/access';

export default function (controller: botkit.Controller) {
    controller.on('raw_message', (bot, message: any) => {
        Console.info(message);
    });
};

function onboard(config: TeamConfig): TeamConfig {
    return config;
}

function onboardConfirmTeamName() {

}

function onboardSheet() {

}

function onboardPayroll() {

}

function onboardUser() {

}