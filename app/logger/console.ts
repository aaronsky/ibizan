const winston = require('winston');

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
  logger.add(winston.transports.Console, {
    prettyPrint: true,
    colorize: true,
    timestamp: true
  });
}

export {
  logger as ConsoleLogger
};