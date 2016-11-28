const winston = require('winston');

const customLevels = {
  levels: winston.config.syslog.levels,
  colors: {
    silly: 'pink'
  }
};
const syslogLevels = Object.keys(winston.config.syslog.levels);
customLevels.levels['silly'] = winston.config.syslog.levels[syslogLevels[syslogLevels.length - 1]] + 1;

winston.remove(winston.transports.Console);
winston.setLevels(customLevels.levels);
winston.addColors(customLevels.colors);
winston.cli();

if (!process.env.TEST) {
  winston.configure({
    transports: [
      new (winston.transports.Console)({
        level: 'silly',
        levels: customLevels.levels,
        prettyPrint: true,
        colorize: true,
        timestamp: () => {
          return new Date();
        },
        formatter: (options) => {
          return `[Ibizan] (${options.timestamp()}) ${options.level.toUpperCase()}: ${!!options.message ? options.message : ''} ${(options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '')}`;
        }
      })
    ]
  });
}

export {
  winston as ConsoleLogger
};