import Localization from '../localization';

function uptime(orgName: string, initDate: Date, minutes: number): string {
    return `${orgName}'s Ibizan has been up since ${initDate} _(${minutes} minutes)_`;
}

function user(name: string, found: boolean): string {
    const failCopy = ' could not be found. Make sure you\'re using their Slack name.';
    return `User ${name}${found ? ':' : failCopy}`;
}

const diagnosticsCopy: Localization.DiagnosticsLocalizedCopy = {
    uptime: uptime,
    users: 'All users:',
    user: user,
    projects: 'All projects:',
    calendar: 'Organization calendar:',
    syncSuccess: 'Resynced with spreadsheet',
    syncFailed: 'Failed to resync',
    help: '*Ibizan Help*\n\nTo clock in with Ibizan, either mention @ibizan in a public channel, use the slash command, or DM Ibizan directly. Your command should follow this format:\n\n`@ibizan [mode] [time] [date] [project] [notes]`\n\nExamples:\n`@ibizan in`\n`@ibizan out`\n`@ibizan in at 9:15`\n`@ibizan out 4:30p yesterday`\n`@ibizan in #project-name`\n`@ibizan 3.5 hours today`\n\nPunches can be `in`, `out`, `vacation`, `sick` or `unpaid` punches. You can also clock in independent blocks of time.\n\nProjects must be registered in the worksheet labeled "Projects" in the Ibizan spreadsheet, and won\'t be recognized as projects in a command without a pound-sign (i.e. #fight-club).\n\nIf you want to see how much time you\'ve worked, use `@ibizan today?` or `@ibizan week?`.\n\nIf something is wrong with your punch, you can undo it by using `@ibizan undo`. You can also modify it manually using the Ibizan spreadsheet, in the worksheet labeled "Raw Data". If you make any manual changes to the spreadsheet, Ibizan should sync automatically, but if you think there is an issue, you can manually sync with `@ibizan sync`.\n\nFor more documentation, please check out https://github.com/ibizan/ibizan.github.io/wiki',
    userHelp: 'Use `@ibizan user [slack name]` to view a user\'s Slack info!'
};

export = diagnosticsCopy;