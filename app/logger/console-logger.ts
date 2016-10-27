import * as console from 'console';

const chalk = require('chalk');
import { STRINGS } from '../shared/constants';
const strings = STRINGS.logger;

export namespace ConsoleLogger {
  let LOG_LEVEL: number;
  const TEST = process.env.TEST || false;
  const debugHeader = chalk.bold.green;
  const debugBody = chalk.green;
  const logHeader = chalk.bold.blue;
  const logBody = chalk.blue;
  const warnHeader = chalk.bold.yellow;
  const warnBody = chalk.yellow;
  const errHeader = chalk.bold.red;
  const errBody = chalk.red;
  const funHeader = chalk.bold.magenta;
  const funBody = chalk.magenta;

  type ValidLogLevels = 'info' | 'warn' | 'warning' | 'error' | 'debug' | 'true' | 0 | 1 | 2 | 3 | 4;
  export function setLogLevel(level: ValidLogLevels) {
    if (typeof level === 'number') {
      LOG_LEVEL = level;
    } else if (typeof level === 'string') {
      if (level === 'debug') {
      LOG_LEVEL = 4;
    } else if (level === 'info' || level === 'true') {
      LOG_LEVEL = 3;
    } else if (level === 'warn' || level === 'warning') {
      LOG_LEVEL = 2;
    } else if (level === 'error') {
      LOG_LEVEL = 1;
    }
    } else {
      LOG_LEVEL = 0;
    }
    console.log(logHeader(`[Ibizan] (${new Date()}) INFO: `) + logBody(`Set log level to ${level}`));
  }

  export function clean(msg: any) {
    let message = '';

    if (typeof msg === 'string') {
      message = msg
    } else if (typeof msg === 'object' && msg.message) {
      message = msg.message
    }

    let response, match;
    if (match = message.match(/Error: HTTP error (.*) \((?:.*)\) -/)) {
      const errorCode = match[1];
      if (errorCode === '500' || errorCode === '502' || errorCode === '404') {
        response = strings.googleerror;
      }
    } else {
      response = message;
    }
    return response;
  }
  export function debug(msg: string) {
    if (msg && LOG_LEVEL >= 4) {
      console.log(debugHeader(`[Ibizan] (${new Date()}) DEBUG: `) + debugBody(`${msg}`));
    }
  }
  export function log(msg: string) {
    if (msg && LOG_LEVEL >= 3) {
      console.log(logHeader(`[Ibizan] (${new Date()}) INFO: `) + logBody(`${msg}`));
    }
  }
  export function warn(msg: string) {
    if (msg && LOG_LEVEL >= 2) {
      console.warn(warnHeader(`[Ibizan] (${new Date()}) WARN: `) + warnBody(`${msg}`));
    }
  }
  export function error(msg: string, error?: any) {
    if (msg && LOG_LEVEL >= 1) {
      console.error(errHeader(`[Ibizan] (${new Date()}) ERROR: `) + errBody(`${msg}`), error || '');
      if (error && error.stack) {
        console.error(errHeader(`[Ibizan] (${new Date()}) STACK: `) + errBody(`${error.stack}`));
      }
    }
  }
  export function fun(msg: string) {
    if (msg && !TEST) {
      const now = new Date().toString();
      console.log(funHeader(`[Ibizan] (${now}) > `) + funBody(`${msg}`));
    }
  }
}