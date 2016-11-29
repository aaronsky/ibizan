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
      warning: 'red',
      notice: 'yellow',
      silly: 'pink',
      info: 'green',
      debug: 'blue'
    }
  };

const logger = new winston.Logger({
  level: 'info',
  levels: customLevels.levels,
  colors: customLevels.colors
});

logger.setLevels(customLevels.levels);
winston.addColors(customLevels.colors);
logger.cli();

if (!process.env.TEST) {
  logger.add(winston.transports.Console, {
    level: 'info',
    levels: customLevels.levels,
    prettyPrint: true,
    colorize: true,
    timestamp: true
  });
}

export {
  logger as ConsoleLogger
};