import { Organization } from '../models/organization';
import * as moment from 'moment';

import { TeamConfig } from '../config';
import Localization from '../i18n/localization';

export function typeIsArray(value: any) {
    return (value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length')));
}

export function isDMChannel(channel: string) {
    return channel.substring(0, 1) === 'D';
}

export function random<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

export type Mode = 'in' | 'out' | 'vacation' | 'sick' | 'unpaid' | 'none';

export interface Team extends botkit.Team {
    config?: TeamConfig;
}

export interface SlackUser {
    [props: string]: any;
    id: string;
    name: string;
    is_admin: boolean;
}

export interface SlackChannel {
    [props: string]: any;
    id: string;
    name: string;
}

export interface Message extends botkit.Message {
    user_obj?: SlackUser;
    channel_obj?: SlackChannel;
    options?: {
        id?: string;
        userRequired?: boolean;
        adminOnly?: boolean;
    };
    organization?: Organization;
    copy: Localization.LocalizedCopy
}