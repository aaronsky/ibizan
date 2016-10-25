
import * as chalk from 'chalk';
import { STRINGS } from '../shared/constants';

const strings = STRINGS.logger;
const TEST = process.env.TEST || false;

let logLevelEnvString;
if (logLevelEnvString = process.env.LOG_LEVEL) {
  if (typeof logLevelEnvString === 'string') {
    logLevelEnvString = logLevelEnvString.toLowerCase();
    var LOG_LEVEL = logLevelEnvString;
    if (['info', 'warn', 'warning', 'error', 'debug', 'true'].indexOf(LOG_LEVEL) === -1) {
      LOG_LEVEL = 0;
    } else if (LOG_LEVEL === 'debug') {
      LOG_LEVEL = 4;
    } else if (LOG_LEVEL === 'info' || LOG_LEVEL === 'true') {
      LOG_LEVEL = 3;
    } else if (LOG_LEVEL === 'warn' || LOG_LEVEL === 'warning') {
      LOG_LEVEL = 2;
    } else if (LOG_LEVEL === 'error') {
      LOG_LEVEL = 1;
    }
  } else if (typeof logLevelEnvString === 'integer' && logLevelEnvString >= 0 && logLevelEnvString <= 4) {
    LOG_LEVEL = logLevelEnvString;
  } else {
    LOG_LEVEL = 0;
  }
} else {
  LOG_LEVEL = 0;
}

const debugHeader = chalk.bold.green;
const debug = chalk.green;
const logHeader = chalk.bold.blue;
const log = chalk.blue;
const warnHeader = chalk.bold.yellow;
const warn = chalk.yellow;
const errHeader = chalk.bold.red;
const err = chalk.red;
const funHeader = chalk.bold.magenta;
const fun = chalk.magenta;

export namespace ConsoleLogger {
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
      console.log(debugHeader(`[Ibizan] (${new Date()}) DEBUG: `) + debug(`${msg}`));
    }
  }
  export function log(msg: string) {
    if (msg && LOG_LEVEL >= 3) {
      console.log(logHeader(`[Ibizan] (${new Date()}) INFO: `) + log(`${msg}`));
    }
  }
  export function warn(msg: string) {
    if (msg && LOG_LEVEL >= 2) {
      console.warn(warnHeader(`[Ibizan] (${new Date()}) WARN: `) + warn(`${msg}`));
    }
  }
  export function error(msg: string, error?: any) {
    if (msg && LOG_LEVEL >= 1) {
      console.error(errHeader(`[Ibizan] (${new Date()}) ERROR: `) + err(`${msg}`), error || '');
      if (error && error.stack) {
        console.error(errHeader(`[Ibizan] (${new Date()}) STACK: `) + err(`${error.stack}`));
      }
    }
  }
  export function fun(msg: string) {
    if (msg && !TEST) {
      console.log(funHeader(`[Ibizan] (${new Date()}) > `) + fun(`${msg}`));
    }
  }
}