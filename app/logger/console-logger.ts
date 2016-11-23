const winston = require('winston');

const customLevels = {
  levels: winston.config.syslog.levels,
  colors: winston.config.syslog.colors
};
const syslogLevels = Object.keys(winston.config.syslog.levels);
customLevels.levels['silly'] = winston.config.syslog.levels[syslogLevels[syslogLevels.length - 1]] + 1;
customLevels.colors['silly'] = 'pink';

const logger = new winston.Logger({
  levels: customLevels.levels,
  colors: customLevels.colors,
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