
interface RegexConstants {
    ibizan: RegExp;
    modes: RegExp;
    days: RegExp;
    rel_time: RegExp;
    time: RegExp;
    months: RegExp;
    date: RegExp;
    numdate: RegExp;
}
export const REGEX: RegexConstants = {
    ibizan: /^(?:@)?ibizan(?::)? ?/i,
    modes: /\b(in|out|vacation|sick|unpaid)\b/i,
    days: /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
    rel_time: /(half-day|(half day)|noon|midnight|((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours))/i,
    time: /(\b(0?[1-9])|(1[0-2]))(?:(:[0-5][0-9] ?(am?|pm?)?\b)| ?(am?|pm?)\b)|((\b([0-1][0-9])|(2[0-3])):([0-5][0-9])\b)/i,
    months: /\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?|Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?|Feb(?:ruary)?)\b/i,
    date: /(\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?) (?:3[01]|[0-2]*[0-9])(?: ?- ?(3[01]|[0-2]*[0-9]))?\b)|(\b(?:Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?) (?:30|[0-2]*[0-9])(?: ?- ?(30|[0-2]*[0-9]))?\b)|(\b(?:Feb(?:ruary)?) (?:29|[0-2]*[0-8])(?: ?- ?(29|[0-2]*[0-8]))?\b)/i,
    numdate: /((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b))(?: ?- ?((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b)))?(?:\/((19[6-9][0-9])|(2[0-9]{3})))?/i,
};

export const REGEX_STR = Object.keys(REGEX)
    .reduce((acc, key) =>
        ({
            ...acc,
            [key]: REGEX[key].toString().substring(1, REGEX[key].toString().indexOf('/i'))
        }),
    {} as {
        [key in keyof RegexConstants]: string;
    });

export const MODES = ['in', 'out', 'vacation', 'sick', 'unpaid'];

export const TIMEZONE = 'America/Phoenix';

export const EVENTS = {
    hear: ['direct_message', 'direct_mention', 'mention', 'ambient'],
    respond: ['direct_message', 'direct_mention', 'mention'],
    onboardTeam: 'ibizan_onboard_team',
    onboardUser: 'ibizan_onboard_user',
    shouldHound: 'ibizan_should_hound',
    resetHound: 'ibizan_reset_hound',
    dailyReport: 'ibizan_daily_report',
    payrollReport: 'ibizan_payroll_report',
    payrollWarning: 'ibizan_payroll_warning'
};

export const BLACKLISTED_SLACK_MESSAGE_TYPES = ['desktop_notification'];