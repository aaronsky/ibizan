import Localization from './localization';

namespace Copy {
    type LocalizedCopyStore = { [language: string]: Localization.LocalizedCopy };
    // Languages for which messages are defined under this dir are acceptable
    export const acceptableLanguages = Localization.Locales.approved;

    export let defaultLocale = '';

    export function setDefaultLocale(locale: string) {
        if (acceptableLanguages.includes(locale)) {
            defaultLocale = locale;
            console.log(`Set the default locale to ${locale}`);
        }
    }

    export function forLocale(locale: string = defaultLocale): Localization.LocalizedCopy {
        const copy = Localization.Locales.allLocales[locale];
        return copy;
    }
}
export default Copy;