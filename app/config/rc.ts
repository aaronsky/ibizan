import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { IbizanConfig } from './types';

const REQUIRED_SCOPES = ['bot', 'im:read'];

export function createIbizanConfig(rcPathOverride?: string, optsPath?: string, args?: any): IbizanConfig {
    const rcConfig = loadIbizanRc(rcPathOverride);
    const optsConfig = loadOpts(optsPath);
    const argsConfig = loadArgs(args);
    const envConfig = loadEnv();

    const config: IbizanConfig = {
        port: envConfig.port || argsConfig.port || optsConfig.port || rcConfig.port || null,
        storageUri: envConfig.storageUri || argsConfig.storageUri || optsConfig.storageUri || rcConfig.storageUri || null,
        slack: {
            clientId: envConfig.slack.clientId || argsConfig.slack.clientId || optsConfig.slack.clientId || rcConfig.slack.clientId || null,
            clientSecret: envConfig.slack.clientSecret || argsConfig.slack.clientSecret || optsConfig.slack.clientSecret || rcConfig.slack.clientSecret || null,
            verificationToken: envConfig.slack.verificationToken || argsConfig.slack.verificationToken || optsConfig.slack.verificationToken || rcConfig.slack.verificationToken || null,
            scopes: REQUIRED_SCOPES
        },
        googleCredentials: envConfig.googleCredentials || argsConfig.googleCredentials || optsConfig.googleCredentials || rcConfig.googleCredentials || null
    };
    console.log(config);
    return config;
}

function makeEmptyConfig(): IbizanConfig {
    return {
        port: null,
        storageUri: null,
        slack: {
            clientId: null,
            clientSecret: null,
            verificationToken: null,
            scopes: REQUIRED_SCOPES
        },
        googleCredentials: null
    };
}

function loadIbizanRc(overridePath?: string): IbizanConfig {
    const filename = '.ibizanrc.json';
    const homeDir = os.homedir();
    const homePath = path.resolve(homeDir, filename);
    const currentDir = process.cwd();
    const currentPath = path.resolve(currentDir, filename);

    let pathToLoad: string;
    const pathFound = [overridePath, currentPath, homePath].some(pathStr => {
        if (pathStr && fs.existsSync(pathStr)) {
            pathToLoad = path.resolve(pathStr);
            return true;
        }
        return false;
    });
    if (!pathFound && !pathToLoad) {
        console.warn(`.ibizanrc.json not found in any of the default locations${overridePath ? ', or in the override location' : ''}.`);
        return makeEmptyConfig();
    }
    console.log('Loading .ibizanrc.json from ' + pathToLoad);
    try {
        return loadJSON(pathToLoad);
    } catch (err) {
        console.error('Invalid .ibizanrc.json file', err);
        throw err;
    }
}

function loadOpts(optsPath?: string): IbizanConfig {
    if (!fs.existsSync(optsPath)) {
        return makeEmptyConfig();
    }
    let contents;
    try {
        contents = fs.readFileSync(optsPath, 'utf8')
            .replace('/\\\s/g', '%20')
            .split(/\s/)
            .filter(Boolean)
            .map(value => value.replace(/%20/g, ' '));
    } catch (err) {
        throw err;
    }
    const config: any = {};
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
}

function loadArgs(args?: any): IbizanConfig {
    if (!args) {
        return makeEmptyConfig();
    }
    const config = makeEmptyConfig();
    if (args.port) {
        config.port = args.port;
    }
    if (args.storageUri) {
        config.storageUri = args.storageUri;
    }
    if (args.slackClientId || args.slackId) {
        config.slack.clientId = args.slackClientId || args.id;
    }
    if (args.slackClientSecret || args.slackSecret) {
        config.slack.clientSecret = args.slackClientSecret || args.secret;
    }
    if (args.slackVerificationToken || args.token) {
        config.slack.verificationToken = args.slackVerificationToken || args.token;
    }
    if (args.googleCredentials) {
        config.googleCredentials = loadGoogleCredentials(args.googleCredentials);
    }
    return config;
}

function loadEnv(env = process.env): IbizanConfig {
    const config = makeEmptyConfig();
    if (env.PORT || env.IBIZAN_PORT || env.NODE_PORT) {
        config.port = env.PORT || env.IBIZAN_PORT || env.NODE_PORT;
    }
    if (env.IBIZAN_STORAGE_URI) {
        config.storageUri = env.IBIZAN_STORAGE_URI;
    }
    if (env.IBIZAN_SLACK_CLIENT_ID) {
        config.slack.clientId = env.IBIZAN_SLACK_CLIENT_ID;
    }
    if (env.IBIZAN_SLACK_CLIENT_SECRET) {
        config.slack.clientSecret = env.IBIZAN_SLACK_CLIENT_SECRET;
    }
    if (env.IBIZAN_SLACK_VERIFICATION_TOKEN) {
        config.slack.verificationToken = env.IBIZAN_SLACK_VERIFICATION_TOKEN;
    }
    if (env.IBIZAN_GOOGLE_CREDENTIALS) {
        config.googleCredentials = loadGoogleCredentials(env.IBIZAN_GOOGLE_CREDENTIALS);
    }
    return config;
}

function loadJSON(path: string): IbizanConfig {
    if (!fs.existsSync(path)) {
        return makeEmptyConfig();
    }
    try {
        const contents = fs.readFileSync(path, 'utf-8');
        const json = JSON.parse(contents);
        return loadArgs(json);
    } catch (err) {
        throw err;
    }
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
            const homeDir = os.homedir();
            const credentialsPath = path.resolve(homeDir ? credentials.replace(/^~($|\/|\\)/, `${homeDir}$1`) : credentials);
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