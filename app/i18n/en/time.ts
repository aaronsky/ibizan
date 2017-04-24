import Localization from '../localization';

function forbiddenChannel(channel: string, clockChannel: string) {
    return `You cannot punch in #${channel}. Try punching in #${clockChannel}, a designated project channel, or here.`;
}

function undoSuccess(undoneDescription: string, lastDescription?: string) {
    let message = `Undid your last punch, which was: *${undoneDescription}*\n\n`;
    if (lastDescription) {
        return `${message}Your most current punch is now: *${lastDescription}*`;
    }
    return `${message}That was your last punch on record.`;
}

const timeCopy: Localization.TimeLocalizedCopy = {
    forbiddenChannel: forbiddenChannel,
    activeFail: 'I couldn\'t understand your request. Make sure you\'re using the correct syntax, for example: `@ibizan active start 10am`',
    activeHelp: 'Use `@ibizan active [start/end] [time]` to set your active hours!\n Example: `@ibizan active start 10am`',
    addFail: 'I could not understand what you are trying to add. Things you could `add` include:\n`add note [note]` - Append a note to your current punch\n`add project [#project]` - Append a project to your current punch\n`add event [date] [name]` - Add a new event to the calendar',
    hoursHelp: 'Use `@ibizan hours [date]` to view your punches on that date.\nUse `@ibizan hours?` (or today?/week?/month?/year?) to view your punches for the given time period.',
    noEvents: 'There are no upcoming events on the calendar.',
    notPunchedIn: 'I don\'t think you\'re punched in right now. If this is in error, ask me to `sync` then try your punch again, or contact an admin.',
    undoSuccess: undoSuccess,
    undoFail: 'There is nothing for me to undo.',
    undoError: 'Something went horribly wrong while undoing your punch.'
};
export = timeCopy;