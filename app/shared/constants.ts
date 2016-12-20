
export const REGEX = {
  ibizan: /^(?:@)?ibizan(?::)? ?/i,
  modes: /\b(in|out|vacation|sick|unpaid)\b/i,
  days: /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
  rel_time: /(half-day|(half day)|noon|midnight|((0+)?(?:\.+[0-9]*) hours?)|(0?1 hour)|(1+(?:\.+[0-9]*)? hours)|(0?[2-9]+(?:\.+[0-9]*)? hours)|([1-9][0-9]+(?:\.+[0-9]*)? hours))/i,
  time: /(\b(0?[1-9])|(1[0-2]))(?:(:[0-5][0-9] ?(am?|pm?)?\b)| ?(am?|pm?)\b)|((\b([0-1][0-9])|(2[0-3])):([0-5][0-9])\b)/i,
  months: /\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?|Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?|Feb(?:ruary)?)\b/i,
  date: /(\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?) (?:3[01]|[0-2]*[0-9])(?: ?- ?(3[01]|[0-2]*[0-9]))?\b)|(\b(?:Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?) (?:30|[0-2]*[0-9])(?: ?- ?(30|[0-2]*[0-9]))?\b)|(\b(?:Feb(?:ruary)?) (?:29|[0-2]*[0-8])(?: ?- ?(29|[0-2]*[0-8]))?\b)/i,
  numdate: /((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b))(?: ?- ?((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b)))?(?:\/((19[6-9][0-9])|(2[0-9]{3})))?/i,
};

let regexStringVariants: any = {};
for (let key in REGEX) {
  let regexString = REGEX[key].toString();
  regexStringVariants[key] = regexString.substring(1, regexString.indexOf('/i'));
}
export const REGEX_STR = regexStringVariants;

export const STRINGS = {
  access: {
    adminonly: "You must be an admin in order to access this command.",
    askforhelp: [
      "Maybe you should ask for `help`?",
      "Perhaps you should ask for `help`?",
      "You could ask for `help`, if you'd like.",
    ],
    badtoken: "Bad token in Ibizan configuration. Please contact an admin.",
    notanemployee: "You are not a recognized employee. Please contact an admin.",
    orgnotready: "The organization isn't ready for operations yet. It may be in the middle of syncing or something has gone horribly wrong. Please try again later, and if this persists longer than five minutes, DM a maintainer as soon as possible.",
    unknowncommand: [
      "tilts their head confusedly.",
      "stares blankly.",
      "listens intently, but doesn't know what you meant.",
      "barks with no clear intention.",
      "extends its paw, unsure of what you actually wanted it to do.",
    ],
  },
  bark: {
    bark: [
      "bark",
      "bark bark",
      "bark bark bark",
    ],
    fetchsuffix: [
      "",
      " while excitedly panting",
      " and awaits a cookie",
      " and sits obediently",
      " and barks loudly",
      " and stares expectantly",
      ", then runs a quick lap around the channel",
    ],
    goodboy: ":ok_hand:",
    story: [
      "woof woof woof",
      "bark woof bark bark woof woof",
      "whine",
    ],
  },
  diagnostics: {
    help: "*Ibizan Help*\n\nTo clock in with Ibizan, either mention @ibizan in a public channel, use the slash command, or DM Ibizan directly. Your command should follow this format:\n\n`@ibizan [mode] [time] [date] [project] [notes]`\n\nExamples:\n`@ibizan in`\n`@ibizan out`\n`@ibizan in at 9:15`\n`@ibizan out 4:30p yesterday`\n`@ibizan in #project-name`\n`@ibizan 3.5 hours today`\n\nPunches can be `in`, `out`, `vacation`, `sick` or `unpaid` punches. You can also clock in independent blocks of time.\n\nProjects must be registered in the worksheet labeled 'Projects' in the Ibizan spreadsheet, and won't be recognized as projects in a command without a pound-sign (i.e. #fight-club).\n\nIf you want to see how much time you've worked, use `@ibizan today?` or `@ibizan week?`.\n\nIf something is wrong with your punch, you can undo it by using `@ibizan undo`. You can also modify it manually using the Ibizan spreadsheet, in the worksheet labeled 'Raw Data'. If you make any manual changes to the spreadsheet, Ibizan should sync automatically, but if you think there is an issue, you can manually sync with `@ibizan sync`.\n\nFor more documentation, please check out https://github.com/ibizan/ibizan.github.io/wiki",
    userhelp: "Use `@ibizan user [slack name]` to view a user's slack info!",
  },
  hound: {
    annoying: "\n\nIf you think I'm being an annoying dog, you can adjust your hounding settings with `hound`, or your active hours with `active`! Use `status` to see when I think you are active. Use `hound pause` to shut me up for the day.",
    houndhelp: "Change hounding settings using `hound (scope) (command)`! Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`",
    punchin: [
      "Punch in if you're on the clock~",
      "Don't forget to punch in if you're working~",
      "You should punch in if you're working~",
      "Make sure to punch in if you're doing work~",
      "You may want to punch in~",
    ],
    punchout: [
      "Don't forget to punch out if you're not working~",
      "Punch out if you're off the clock~",
      "You should punch out if you're not working~",
      "Make sure to punch out when you're done working~",
      "You may want to punch out~",
    ],
  },
  logger: {
    failedreaction: "I just tried to react to a message, but something went wrong. This is usually the last step in an operation, so your command probably worked.",
    googleerror: "Something went wrong on Google's end and the operation couldn't be completed. Please try again in a minute. If this persists for longer than 5 minutes, DM an admin ASAP.",
  },
  time: {
    activefail: "I couldn't understand your request. Make sure you're using the correct syntax, for example: `@ibizan active start 10am`",
    activehelp: "Use `@ibizan active [start/end] [time]` to set your active hours!\n Example: `@ibizan active start 10am`",
    addfail: "I could not understand what you are trying to add. Things you could `add` include:\n`add note [note]` - Append a note to your current punch\n`add project [#project]` - Append a project to your current punch\n`add event [date] [name]` - Add a new event to the calendar",
    hourshelp: "Use `@ibizan hours [date]` to view your punches on that date.\nUse `@ibizan hours?` (or today?/week?/month?/year?) to view your punches for the given time period.",
    noevents: "There are no upcoming events on the calendar.",
    notpunchedin: "I don't think you're punched in right now. If this is in error, ask me to `sync` then try your punch again, or contact an admin.",
    undofail: "There is nothing for me to undo.",
  },
};

export const MODES = ['in', 'out', 'vacation', 'unpaid', 'sick'];

export const TIMEZONE = 'America/Phoenix';

export const EVENTS = {
  hear: ['direct_message', 'direct_mention', 'mention', 'ambient'],
  respond: ['direct_message', 'direct_mention', 'mention'],
  shouldHound: 'ibizan_should_hound',
  resetHound: 'ibizan_reset_hound',
  dailyReport: 'ibizan_daily_report',
  payrollReport: 'ibizan_payroll_report',
  payrollWarning: 'ibizan_payroll_warning'
};

export const BLACKLISTED_SLACK_MESSAGE_TYPES = ['desktop_notification'];