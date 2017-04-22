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
    interface AccessLocalizedCopy {
        adminOnly: string;
        askForHelp: string[];
        badToken: string;
        notAnEmployee: string;
        orgNotReady: string;
        unknownCommand: string[];
    }
    interface BarkLocalizedCopy {
        bark: string[];
        fetch: string[];
        goodboy: string;
        story: string[];
    }
    interface DiagnosticsLocalizedCopy {
        help: string;
        userHelp: string;
    }
    interface HoundLocalizedCopy {
        annoying: string;
        houndHelp: string;
        punchIn: string[];
        punchOut: string[];
    }
    interface LoggerLocalizedCopy {
        failedReaction: string;
        googleError: string;
    }
    interface TimeLocalizedCopy {
        activeFail: string;
        activeHelp: string;
        addFail: string;
        hoursHelp: string;
        noEvents: string;
        notPunchedIn: string;
        undoFail: string;
    }
 
    type LocaleMap = { [locale: string]: LocalizedCopy }
    export class Locales {
        static localeMap: LocaleMap;
        static init() {
            const dirs = fs.readdirSync(__dirname).filter(file => path.extname(file) === '');
            this.localeMap = dirs.reduce((acc, dir) => {
                return {
                    ...acc,
                    [dir]: require(`./${dir}`)
                };
            }, {} as LocaleMap);
        }
        static get approved(): string[] {
            return Object.keys(this.localeMap).reduce((acc, locale) => {
                if (this.localeMap[locale].status === 'approved') {
                    acc = [...acc, locale];
                }
                return acc;
            }, [])
        }
    }
    Locales.init();
}
export default Localization;