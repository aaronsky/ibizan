import Localization from './localization';
import { Console } from '../logger';

namespace Copy {
    type LocalizedCopyStore = { [language: string]: Localization.LocalizedCopy };
    // Languages for which messages are defined under this dir are acceptable
    export const acceptableLanguages = Localization.Locales.approved;

    export let defaultLocale = '';

    export function setDefaultLocale(locale: string) {
        if (acceptableLanguages.indexOf(locale) !== -1) {
            defaultLocale = locale;
            Console.info(`Set the default locale to ${locale}`);
        }
    }

    export function forLocale(locale: string = defaultLocale): Localization.LocalizedCopy {
        const copy = Localization.Locales.localeMap[locale];
        return copy;
    }
}
export default Copy;