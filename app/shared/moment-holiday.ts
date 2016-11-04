// Moment.JS Holiday Plugin
//
// Usage:
//   Call .holiday() from any moment object. If date is a US Federal Holiday, name of the holiday will be returned.
//   Otherwise, return nothing.
//
// Example:
//   `moment('12/25/2013').holiday()` will return "Christmas Day"
//
// Holidays:
//   You can configure holiday bellow. The 'M' stands for Month and represents fixed day holidays.
//   The 'W' stands for Week, and represents holidays with date based on week day rules.
//   Example: '10/2/1' Columbus Day (Second monday of october).
//
// License:
//   Copyright (c) 2013 [Jr. Hames](http://jrham.es) under [MIT License](http://opensource.org/licenses/MIT)

import * as moment from 'moment';

// Holiday definitions
const holidays = {
    'M': { // Month, Day
        '01/01': "New Year's Day",
        '04/01': "RAAHB",
        '07/04': "Independence Day",
        '11/11': "Veteran's Day",
        '12/24': "Christmas Eve",
        '12/25': "Christmas Day",
    },
    'W': { // Month, Week of Month, Day of Week (all zero-based)
        '1/3/1': "Martin Luther King Jr. Day",
        '2/3/1': "Washington's Birthday",
        '5/5/1': "Memorial Day",
        '9/1/1': "Labor Day",
        '11/4/4': "Thanksgiving Day"
    }
};

export function holidayForMoment(date: moment.Moment): string {
    const diff = 1 + (0 | (date.get('date') - 1) / 7);
    const memorial = (date.get('day') === 1 && (date.get('date') + 7) > 30) ? '5' : null;
    return (holidays['M'][date.format('MM/DD')] || holidays['W'][date.format('M/' + (memorial || diff) + '/d')]);
}

export function momentForHoliday(name: string): moment.Moment {
    for (let key in holidays['M']) {
        if (holidays['M'][key] === name) {
            const comps = key.split('/') as [string, string];
            const year = new Date().getFullYear();
            const month = parseInt(comps[0]) - 1;
            const day = parseInt(comps[1]);
            const newHoliday = moment({
                year,
                month,
                day
            });
            return newHoliday;
        }
    }
    for (let key in holidays['W']) {
        if (holidays['W'][key] === name) {
            const comps = key.split('/') as [string, string, string];
            const year = new Date().getFullYear();
            const month = parseInt(comps[0]) - 1;
            const newHoliday = moment({
                year,
                month
            });
            const maxDays = moment({
                year,
                month
            }).endOf('month').date();
            let week = parseInt(comps[1]);
            if (maxDays < 31) {
                week = week <= 1 ? 1 : week - 1;
            }
            const day = parseInt(comps[2]);
            newHoliday.date(7 * week).day(day);
            return newHoliday;
        }
    }
    return null;
}
