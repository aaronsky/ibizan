const winston = require('winston');

const logger = new winston.Logger({
  levels: winston.config.syslog.levels,
  transports: [
    new winston.transports.Console({
      prettyPrint: true,
      colorize: true,
      timestamp: () => {
        return new Date();
      },
      formatter: (options) => {
        if (process.env.TEST) {
          return '';
        }
        return `[Ibizan] (${options.timestamp()}) ${options.level.toUpperCase()}: ${!!options.message ? options.message : ''} ${(options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '')}`;
      }
    })
  ]
});

logger.cli();

export {
  logger as ConsoleLogger
};