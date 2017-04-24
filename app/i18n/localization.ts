import * as fs from 'fs';
import * as path from 'path';

namespace Localization {
    type QAStatus = 'approved' | 'in-review' | 'development';
    export interface LocalizedCopy {
        status: QAStatus;
        access: AccessLocalizedCopy;
        bark: BarkLocalizedCopy;
        diagnostics: DiagnosticsLocalizedCopy;
        hound: HoundLocalizedCopy;
        logger: LoggerLocalizedCopy;
        time: TimeLocalizedCopy;
    }
    export interface AccessLocalizedCopy {
        adminOnly: string;
        askForHelp: string[];
        badToken: string;
        notAnEmployee: string;
        orgNotReady: string;
        unknownCommand: string[];
    }
    export interface BarkLocalizedCopy {
        bark: string[];
        fetch: (phase: 0 | 1 | 2 | 3, username: string, thing?: string) => string;
        goodboy: string;
        story: string[];
    }
    export interface DiagnosticsLocalizedCopy {
        uptime: (orgName: string, initDate: Date, minutes: number) => string;
        users: string;
        user: (name: string, found: boolean) => string;
        projects: string;
        calendar: string;
        syncSuccess: string;
        syncFailed: string;
        help: string;
        userHelp: string;
    }
    export interface HoundLocalizedCopy {
        annoying: string;
        houndHelp: string;
        punch: (mode: 'in' | 'out') => string;
        punchIn: string[];
        punchOut: string[];
    }
    export interface LoggerLocalizedCopy {
        failedReaction: string;
        googleError: string;
    }
    export interface TimeLocalizedCopy {
        forbiddenChannel: (channel: string, clockChannel: string) => string;
        activeFail: string;
        activeHelp: string;
        addFail: string;
        hoursHelp: string;
        noEvents: string;
        notPunchedIn: string;
        undoSuccess: (undoneDescription: string, lastDescription?: string) => string;
        undoError: string;
        undoFail: string;
    }

    type LocaleMap = { [locale: string]: LocalizedCopy }
    export namespace Locales {
        export const allLocales: LocaleMap = fs.readdirSync(__dirname)
            .filter(file => path.extname(file) === '')
            .reduce((acc, dir) => {
                return {
                    ...acc,
                    [dir]: require(`./${dir}`)
                };
            }, {} as LocaleMap);
        export const approved = Object.keys(allLocales).reduce((acc, locale) => {
            if (allLocales[locale].status === 'approved') {
                acc = [...acc, locale];
            }
            return acc;
        }, []);
    }
}
export default Localization;