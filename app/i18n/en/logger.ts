import Localization from '../localization';

const loggerCopy: Localization.LoggerLocalizedCopy = {
    failedReaction: 'I just tried to react to a message, but something went wrong. This is usually the last step in an operation, so your command probably worked.',
    googleError: 'Something went wrong on Google\'s end and the operation couldn\'t be completed. Please try again in a minute. If this persists for longer than 5 minutes, DM an admin ASAP.'
};

export = loggerCopy;