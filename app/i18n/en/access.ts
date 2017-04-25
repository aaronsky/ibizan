import Localization from '../localization';

const accessCopy: Localization.AccessLocalizedCopy = {
    adminOnly: 'You must be an admin in order to access this command.',
    askForHelp: [
        'Maybe you should ask for `help`?',
        'Perhaps you should ask for `help`?',
        'You could ask for `help`, if you\'d like.'
    ],
    badToken: 'Bad token in Ibizan configuration. Please contact an admin.',
    notAnEmployee: 'You are not a recognized employee. Please contact an admin.',
    orgNotReady: 'The organization isn\'t ready for operations yet. It may be in the middle of syncing, or something has gone horribly wrong. Please try again later, and if this persists longer than five minutes, DM a maintainer as soon as possible.',
    unknownCommand: [
        'tilts their head confusedly.',
        'stares blankly.',
        'listens intently, but doesn\'t know what you meant.',
        'barks with no clear intention.',
        'extends its paw, unsure of what you actually wanted it to do.'
    ]
}

export = accessCopy;