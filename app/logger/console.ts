const winston = require('winston');

const logger = new winston.Logger({
  level: 'info'
});

logger.cli();

if (!process.env.TEST) {
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
  logger.add(winston.transports.Console, {
    level: 'info',
    levels: customLevels.levels,
    prettyPrint: true,
    colorize: true,
    timestamp: () => {
      return new Date();
    },
    formatter: (options) => {
      return `[Ibizan] (${options.timestamp()}) ${options.level.toUpperCase()}: ${!!options.message ? options.message : ''} ${(options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '')}`;
    }
  });
  logger.setLevels(customLevels.levels);
  winston.addColors(customLevels.colors);
}

export {
  logger as ConsoleLogger
};