// Description:
//   Your dog friend guards access to your most prized commands
//
// Commands:
//
// Author:
//   bcoia

import * as Logger from '../logger';
import { Organization } from '../models/organization';

export function buildOptions(options: { id?: string, userRequired?: boolean, adminOnly?: boolean }, controller: botkit.Controller, patterns: string[] | RegExp[], message: botkit.Message) {
  message.options = options;
  return controller.hears_test(patterns, message);
};