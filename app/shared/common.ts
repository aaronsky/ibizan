import { Organization } from '../models/organization';
import * as moment from 'moment';

import { TeamConfig } from '../config';

export function typeIsArray(value: any) {
  return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export function isDMChannel(channel: string) {
    return channel.substring(0, 1) === 'D';
  }

export function random<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface Team extends botkit.Team {
  config?: TeamConfig;
}

export interface Message extends botkit.Message {
  user_obj?: {
    [props: string]: any;
    id: string;
    name: string;
    is_admin: boolean;
  };
  channel_obj?: {
    [props: string]: any;
    id: string;
    name: string;
  };
  options?: {
    id?: string;
    userRequired?: boolean;
    adminOnly?: boolean;
  };
  organization?: Organization;
}