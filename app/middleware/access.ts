// Description:
//   Your dog friend guards access to your most prized commands
//
// Commands:
//
// Author:
//   bcoia

import { Message } from '../shared/common';
import { Organization } from '../models/organization';

interface HearsOptions {
  id?: string;
  userRequired?: boolean;
  adminOnly?: boolean;
}

let onReceiveCheckAccessHandlerFn: (message: Message) => boolean = null;

export function setAccessHandler(handler: (message: Message) => boolean) {
  onReceiveCheckAccessHandlerFn = handler;
}

export function buildOptions(options: HearsOptions, controller: botkit.Controller) {
  return function (patterns: string[] | RegExp[], message: Message) {
    message.options = options;
    if (controller.hears_test(patterns, message)) {
      if (onReceiveCheckAccessHandlerFn) {
        if (onReceiveCheckAccessHandlerFn(message)) {
          return true;
        }
      }
    }
    return false;
  }
};