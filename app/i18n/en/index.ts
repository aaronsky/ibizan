import Localization from '../localization';

import * as accessCopy from './access';
import * as barkCopy from './bark';
import * as calendarCopy from './calendar';
import * as diagnosticsCopy from './diagnostics';
import * as houndCopy from './hound';
import * as loggerCopy from './logger';
import * as timeCopy from './time';

const copy: Localization.LocalizedCopy = {
    status: 'approved',
    access: accessCopy,
    bark: barkCopy,
    calendar: calendarCopy,
    diagnostics: diagnosticsCopy,
    hound: houndCopy,
    logger: loggerCopy,
    time: timeCopy
}
export = copy;