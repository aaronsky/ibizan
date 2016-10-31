import * as moment from 'moment';

import { TeamConfig } from '../config';

export function typeIsArray(value: any) {
  return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export function random(items: any[]): any {
  return items[Math.floor(Math.random() * items.length)];
}

export interface Bot {
  config: any;
  api: any;
  storage: {
    users: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
    channels: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
    teams: {
      get(data: any, callback: (err: Error, data: any) => void): void;
      save(id: any, callback: (err: Error, data: any[]) => void): void;
      all(callback: (err: Error, data: any[]) => void): void;
    };
  };
  say(message: any);
  reply(message: any, reply: any);
  startRTM(callback: (err: Error) => void);
  startPrivateConversation(user: any, callback: (err: Error, conversation: any) => void);
}

export interface Controller {
  events: any;
  config: any;
  tasks: any;
  taskCount: number;
  convoCount: number;
  memoryStore: {
    users: any;
    channels: any;
    teams: any;
  };
  utterances: {
    yes: RegExp;
    no: RegExp;
    quit: RegExp;
  };
  middleware: {
    send: any;
    receive: any;
    spawn: any;
  };
  webserver: any;
  log: any;
  storage: {
    teams: any;
  }
  spawn(team);
  on(scope: string, callback: (bot: Bot, message: any) => void);
  hears(pattern: string | string[], modes: string | string[], callback: (bot: Bot, message: any) => void);
  hears(pattern: string | string[], modes: string | string[], middleware: () => void, callback: (bot: Bot, message: any) => void);
  setupWebserver(port: any, callback: (err: Error, webserver) => void): void;
  createWebhookEndpoints(webserver: any): void;
  createOauthEndpoints(webserver: any, callback: (err: Error, req, res) => void): void;
};

export interface Team { 
  id: string;
  createdBy: string; 
  url: string;
  name: string;
  config?: TeamConfig;
}