import * as yargsFactory from 'yargs';

const yargs = yargsFactory
    .usage('Usage: $0 [options]')
    .string([
        'config',
        'opts',
        'port',
        'storageUri',
        'slackClientId',
        'slackClientSecret',
        'slackVerificationToken'
    ])
    .array('scopes')
    .count('verbose')
    .alias('config', 'c')
    .nargs('config', 1)
    .describe('config', 'Use configuration from this file')
    .nargs('opts', 1)
    .describe('opts', 'Specify opts path')
    .nargs('port', 1)
    .describe('port', 'Port to use with bot webserver')
    .alias('store', 'storageUri')
    .nargs('store', 1)
    .describe('store', 'URI address of Firebase storage endpoint')
    .alias('id', 'slackClientId')
    .nargs('id', 1)
    .describe('slackClientId', 'Slack Bot client id')
    .alias('secret', 'slackClientSecret')
    .nargs('secret', 1)
    .describe('slackClientSecret', 'Slack Bot client secret key')
    .alias('token', 'slackVerificationToken')
    .nargs('token', 1)
    .describe('slackVerificationToken', 'Slack Bot verification token')
    .alias('verbose', 'v')
    .describe('verbose', 'Verbosity of logs')
    .alias('help', 'h')
    .describe('help', 'Displays help for the Ibizan command line interface')
    .alias('version', 'V')
    .describe('version', 'Outputs the version of Ibizan')
    .help('help')
    .epilog('For more information, check out http://ibizan.github.io or https://github.com/ibizan/ibizan')
    .showHelpOnFail(false);
process.env['IBIZAN_LOG_VERBOSE'] = !!yargs.argv.verbose;

export default yargs;