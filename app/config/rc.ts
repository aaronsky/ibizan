import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { IbizanConfig } from './types';

export function createIbizanConfig(rcPathOverride?: string, optsPath?: string, args?: any): IbizanConfig {
    const rcConfig = loadIbizanRc(rcPathOverride);
    const optsConfig = loadOpts(optsPath);
    const argsConfig = loadArgs(args);

    const shouldCheckOpts = !!optsConfig;
    const shouldCheckArgs = !!argsConfig;

    let config: IbizanConfig = {
        port: null,
        storageUri: null,
        slack: {
            clientId: null,
            clientSecret: null,
            verificationToken: null,
            scopes: null
        },
        googleCredentials: null
    };
    Object.keys(config).forEach(key => {
        if (key === 'slack' && typeof config[key] === 'object') {
            Object.keys(config[key]).forEach(subKey => {
                config[key][subKey] = rcConfig && rcConfig[key] && (rcConfig[key][subKey] || '');
                if (shouldCheckOpts && optsConfig[key] && optsConfig[key][subKey]) {
                    config[key][subKey] = optsConfig[key][subKey];
                }
                if (shouldCheckArgs && argsConfig[key] && argsConfig[key][subKey]) {
                    config[key][subKey] = argsConfig[key][subKey];
                }
            });
        } else {
            config[key] = rcConfig && (rcConfig[key] || null);
            if (shouldCheckOpts && optsConfig[key]) {
                config[key] = optsConfig[key];
            }
            if (shouldCheckArgs && argsConfig[key]) {
                config[key] = argsConfig[key];
            }
        }
    });
    return config;
}

function loadJSON(path: string): any {
    if (fs.existsSync(path)) {
        try {
            const contents = fs.readFileSync(path, 'utf-8');
            const json = JSON.parse(contents);
            return loadArgs(json);
        } catch (err) {
            throw err;
        }
    }
    return;
}
function loadIbizanRc(overridePath?: string) {
    const filename = '.ibizanrc.json';
    const homeDir = os.homedir();
    const homePath = path.resolve(homeDir, filename);
    const currentDir = process.cwd();
    const currentPath = path.resolve(currentDir, filename);

    let pathToLoad: string;
    [overridePath, currentPath, homePath].forEach(path => {
        if (pathToLoad) {
            return;
        } else if (path && fs.existsSync(path)) {
            pathToLoad = path;
        }
    });
    if (!pathToLoad) {
        const warning = '.ibizanrc.json not found in any of the default locations' + (overridePath ? ', or in the override location.' : '.');
        console.warn(warning);
        return null;
    }
    console.log('Loading .ibizanrc.json from ' + pathToLoad);
    try {
        return loadJSON(pathToLoad) as IbizanConfig;
    } catch (err) {
        console.error('Invalid .ibizanrc.json file', err);
        throw err;
    }
}

function loadOpts(optsPath?: string) {
    if (fs.existsSync(optsPath)) {
        try {
            let contents = fs.readFileSync(optsPath, 'utf-8')
                .replace('/\\\s/g', '%20')
                .split(/\s/)
                .filter(Boolean)
                .map(value => value.replace(/%20/g, ' '));
            let config: any;
            const keys = Object.keys(config);
            let key: string = null;
            let buffer: string[] = [];
            contents.forEach((element) => {
                if (element.indexOf('--') && keys.indexOf(element.replace('--', '')) !== -1) {
                    if (key && buffer.length > 0) {
                        config[key] = buffer;
                        buffer = [];
                    }
                    key = element.replace('--', '');
                } else {
                    buffer.push(element);
                }
            });
            return loadArgs(config);
        } catch (err) {
            throw err;
        }
    }
    return null;
}
function loadArgs(args?: any) {
    if (!args) {
        return null;
    }
    let config: IbizanConfig = {
        port: null,
        storageUri: null,
        slack: {
            clientId: null,
            clientSecret: null,
            verificationToken: null,
            scopes: null
        },
        googleCredentials: null
    };
    if (args.port) {
        config.port = args.port || process.env.PORT || process.env.IBIZAN_PORT || process.env.NODE_PORT;
    }
    if (args.storageUri) {
        config.storageUri = args.storageUri || process.env.IBIZAN_STORAGE_URI;
    }
    if (args.slackClientId || args.slackId || process.env.IBIZAN_SLACK_CLIENT_ID) {
        config.slack.clientId = args.slackClientId || args.id || process.env.IBIZAN_SLACK_CLIENT_ID;
    }
    if (args.slackClientSecret || args.slackSecret || process.env.IBIZAN_SLACK_CLIENT_SECRET) {
        config.slack.clientSecret = args.slackClientSecret || args.secret || process.env.IBIZAN_SLACK_CLIENT_SECRET;
    }
    if (args.slackVerificationToken || args.token || process.env.IBIZAN_SLACK_VERIFICATION_TOKEN) {
        config.slack.verificationToken = args.slackVerificationToken || args.token || process.env.IBIZAN_SLACK_VERIFICATION_TOKEN;
    }
    config.slack.scopes = ['bot', 'im:read'];
    if (args.googleCredentials || process.env.IBIZAN_GOOGLE_CREDENTIALS) {
        config.googleCredentials = loadGoogleCredentials(args.googleCredentials || process.env.IBIZAN_GOOGLE_CREDENTIALS);
    }
    return config;
}

function loadGoogleCredentials(credentials: string): string {
    if (typeof credentials !== 'string') {
        return credentials;
    } else if (credentials.length === 0) {
        return credentials;
    }
    const pathRe = /[‘“!#$%&+^<=>`]/;
    const isPath = !pathRe.test(credentials);

    if (isPath) {
        try {
            const home = os.homedir();
            const credentialsPath = path.resolve(home ? credentials.replace(/^~($|\/|\\)/, `${home}$1`) : credentials);
            const stats = fs.lstatSync(credentialsPath);
            if (stats && stats.isFile()) {
                return credentials;
            }
        } catch (error) {
            console.warn('An invalid file path was passed for the Google Credentials file. Checking if JSON was passed...');
        }
    }
    let credentialsPath;
    try {
        const credentialsJson = JSON.parse(credentials);
        const ibizanTmpPath = path.resolve(process.cwd(), '.ibizan');
        credentialsPath = path.resolve(ibizanTmpPath, 'google-credentials.json');
        if (!fs.existsSync(ibizanTmpPath)) {
            fs.mkdirSync(ibizanTmpPath);
        }
        fs.writeFileSync(credentialsPath, JSON.stringify(credentialsJson, null, '\t'));
    } catch (error) {
        console.warn('The passed Google Credentials file data was not valid JSON either. Check your configuration as this will cause breakage.');
        return credentials;
    }
    return credentialsPath;
}