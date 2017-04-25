import * as util from 'util';
import * as winston from 'winston';

declare global {
    interface Console {
        winston: winston.LoggerInstance;
        silly: (...args) => void;
    }
}

const customLevels = {
    levels: {
        emerg: 0,
        alert: 1,
        crit: 2,
        error: 3,
        warning: 4,
        notice: 5,
        silly: 6,
        info: 7,
        debug: 8
    },
    colors: {
        emerg: 'red',
        alert: 'yellow',
        crit: 'red',
        error: 'red',
        warning: 'yellow',
        notice: 'gray',
        silly: 'magenta',
        info: 'blue',
        debug: 'cyan'
    }
};

const logger = new winston.Logger({
    level: 'info',
    levels: customLevels.levels,
    colors: customLevels.colors
});

if (!process.env.TEST) {
    const level = process.env.IBIZAN ? 'debug' : 'info';
    logger.add(winston.transports.Console, {
        level: level,
        prettyPrint: true,
        colorize: true,
        timestamp: true
    });

    function formatArgs(args) {
        return [util.format.apply(util.format, Array.prototype.slice.call(args))];
    }
    console.winston = logger;
    console.silly = function (...args) {
        logger.silly.apply(logger, formatArgs(args));
    };
    console.log = function (...args) {
        logger.info.apply(logger, formatArgs(args));
    };
    console.info = function (...args) {
        logger.info.apply(logger, formatArgs(args));
    };
    console.warn = function (...args) {
        logger.warning.apply(logger, formatArgs(args));
    };
    console.error = function (...args) {
        logger.error.apply(logger, formatArgs(args));
    };
    console.debug = function (...args) {
        logger.debug.apply(logger, formatArgs(args));
    };
} else {
    console.debug = function (...args) {};
    console.silly = function (...args) {};
}