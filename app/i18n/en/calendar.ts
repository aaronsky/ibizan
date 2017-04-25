import * as moment from 'moment';
import Localization from '../localization';
import { Holiday } from '../../models/calendar';

function description(holidays: Holiday[]): string {
    let calendar = '';
    holidays.reduce((acc, holiday) => {
        return `${acc}This year's ${holiday.name} is on ${holiday.date.format('MM/DD/YYYY')}\n`;
    }, calendar);
    return `Organization calendar:\n${calendar}`;
}

function eventDescription(name: string, date: moment.Moment): string {
    return `Calendar Event: ${name}\Date: ${date.format('MM/DD/YYYY')}`;
}

const calendarCopy: Localization.CalendarLocalizedCopy = {
    description: description,
    eventDescription: eventDescription
};

export = calendarCopy;