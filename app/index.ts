import * as path from 'path';
import * as fs from 'fs';
import { args, createIbizanConfig } from './config';
import './logger/console';
import Copy from './i18n';
import { App } from './app';

const argv = args.argv;

if (argv.version) {
    let version = process.env.npm_package_version;
    if (!version) {
        const packageJsonString = fs.readFileSync('../package.json', 'utf-8');
        const packageJson = JSON.parse(packageJsonString);
        version = packageJson.version;
    }
    console.log('Ibizan v' + version);
    process.exit();
}

let config;
try {
    config = createIbizanConfig(argv.config, argv.opts, argv);
} catch (err) {
    console.error(err.message, err);
    args.showHelp();
    process.exit(1);
}

Copy.setDefaultLocale('en');
const ibizan = new App(config);
ibizan.start();