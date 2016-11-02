import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Console } from '../logger';

export interface IbizanConfig {
    port: number;
    storageUri: string;
    slack: {
        clientId: string;
        clientSecret: string;
        verificationToken: string;
        scopes: string[];
    }
}

export interface TeamConfig {
    name: string;
    admins: string[];
    google: {
        sheetId: string;
        clientEmail: string;
        privateKey: string;
    }
}

export class ConfigFactory {
    private constructor() {

    }
    static loadConfiguration(rcPathOverride?: string, optsPath?: string, args?: any): IbizanConfig {
        // load rc
        const rcConfig = ConfigFactory.loadIbizanRc(rcPathOverride);
        // load opts
        const optsConfig = ConfigFactory.loadOpts(optsPath);
        // load args
        const argsConfig = ConfigFactory.loadArgs(args);
        
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
            }
        };
        let temp: IbizanConfig = {
            port: null,
            storageUri: null,
            slack: {
                clientId: null,
                clientSecret: null,
                verificationToken: null,
                scopes: null
            }
        };
        for (let key in temp) {
            if (key === 'slack') {
                for (let slackKey in temp.slack) {
                    config[key][slackKey] = rcConfig && rcConfig[key] && (rcConfig[key][slackKey] || '');
                    if (shouldCheckOpts && optsConfig[key] && optsConfig[key][slackKey]) {
                        config[key][slackKey] = optsConfig[key][slackKey];
                    }
                    if (shouldCheckArgs && argsConfig[key] && argsConfig[key][slackKey]) {
                        config[key][slackKey] = argsConfig[key][slackKey];
                    }
                }
            } else {
                config[key] = rcConfig && (rcConfig[key] || null);
                if (shouldCheckOpts && optsConfig[key]) {
                    config[key] = optsConfig[key];
                }
                if (shouldCheckArgs && argsConfig[key]) {
                    config[key] = argsConfig[key];
                }
            }
        }
        return config;
    }
    private static loadIbizanRc(overridePath?: string) {
        const filename = '.ibizanrc.json';
        const homeDir = os.homedir();
        const homePath = path.resolve(homeDir, filename);
        const currentDir = process.cwd();
        const currentPath = path.resolve(currentDir, filename);

        let pathToLoad: string;
        for (let path of [overridePath, currentPath, homePath]) {
            if (path && fs.existsSync(path)) {
                pathToLoad = path;
                break;
            }
        }
        if (!pathToLoad) {
            const warning = '.ibizanrc.json not found in any of the default locations' + (overridePath ? ', or in the override location.' : '.');
            Console.warn(warning);
            return;
        }
        Console.info('Loading .ibizanrc.json from ' + pathToLoad);
        try {
            return ConfigFactory.loadJSON(pathToLoad) as IbizanConfig;
        } catch (err) {
            Console.error('Invalid .ibizanrc.json file', err);
        }
        return;
    }
    private static loadOpts(optsPath?: string) {
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
                return ConfigFactory.loadArgs(config);
            } catch (err) {
                throw err;
            }
        }
        return;
    }
    private static loadArgs(args?: any) {
        if (!args) {
            return;
        }
        let config: IbizanConfig = {
            port: null,
            storageUri: null,
            slack: {
                clientId: null,
                clientSecret: null,
                verificationToken: null,
                scopes: null
            }
        };
        if (args.port) {
            config.port = args.port || process.env.PORT || process.env.IBIZAN_PORT || process.env.NODE_PORT;
        }
        if (args.storageUri) {
            config.storageUri = args.storageUri || process.env.IBIZAN_STORAGE_URI;
        }
        if (args.slackClientId || args.id || process.env.IBIZAN_SLACK_CLIENT_ID) {
            config.slack.clientId = args.slackClientId || args.id || process.env.IBIZAN_SLACK_CLIENT_ID;
        }
        if (args.slackClientSecret || args.secret || process.env.IBIZAN_SLACK_CLIENT_SECRET) {
            config.slack.clientSecret = args.slackClientSecret || args.secret || process.env.IBIZAN_SLACK_CLIENT_SECRET;
        }
        if (args.slackVerificationToken || args.token || process.env.IBIZAN_SLACK_VERIFICATION_TOKEN) {
            config.slack.verificationToken = args.slackVerificationToken || args.token || process.env.IBIZAN_SLACK_VERIFICATION_TOKEN;
        }
        config.slack.scopes = ['bot'];
        return config;
    }
    static toJSONString(config: IbizanConfig | TeamConfig): string {
        return JSON.stringify(config);
    }
    static loadJSON(path: string): any {
        if (fs.existsSync(path)) {
            try {
                const contents = fs.readFileSync(path, 'utf-8');
                const json = JSON.parse(contents);
                return ConfigFactory.loadArgs(json);
            } catch (err) {
                throw err;
            }
        }
        return;
    }
};