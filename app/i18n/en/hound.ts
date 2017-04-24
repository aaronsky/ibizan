import Localization from '../localization';
import { random } from '../../shared/common';

function punch(mode: 'in' | 'out'): string {
    const shouldBeAnnoying = (Math.floor(Math.random() * 6) + 1) === 1;
    if (mode === 'in') {
        return `${random(houndCopy.punchIn)}${shouldBeAnnoying ? houndCopy.annoying : ''}`;
    } else if (mode === 'out') {
        return `${random(houndCopy.punchOut)}${shouldBeAnnoying ? houndCopy.annoying : ''}`;
    }
}

const houndCopy: Localization.HoundLocalizedCopy = {
    annoying: '\n\nIf you think I\'m being an annoying dog, you can adjust your hounding settings with `hound`, or your active hours with `active`! Use `status` to see when I think you are active. Use `hound pause` to shut me up for the day.',
    houndHelp: 'Change hounding settings using `hound (scope) (command)`! Try something like `hound (self/org) (on/off/pause/reset/status/X hours)`',
    punch: punch,
    punchIn: [
        'Punch in if you\'re on the clock~',
        'Don\'t forget to punch in if you\'re working~',
        'You should punch in if you\'re working~',
        'Make sure to punch in if you\'re doing work~',
        'You may want to punch in~'
    ],
    punchOut: [
        'Don\'t forget to punch out if you\'re not working~',
        'Punch out if you\'re off the clock~',
        'You should punch out if you\'re not working~',
        'Make sure to punch out when you\'re done working~',
        'You may want to punch out~'
    ]
};
export = houndCopy;