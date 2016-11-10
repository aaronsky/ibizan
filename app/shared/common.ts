import * as moment from 'moment';

import { TeamConfig } from '../config';

export function typeIsArray(value: any) {
  return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export function random(items: any[]): any {
  return items[Math.floor(Math.random() * items.length)];
}

export interface Team extends botkit.Team {
  config?: TeamConfig;
}