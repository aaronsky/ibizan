import Localization from '../localization';

import accessCopy from './access';
import barkCopy from './bark';
import diagnosticsCopy from './diagnostics';
import houndCopy from './hound';
import loggerCopy from './logger';
import timeCopy from './time';

const copy: Localization.LocalizedCopy = {
    status: 'approved',
    access: accessCopy,
    bark: barkCopy,
    diagnostics: diagnosticsCopy,
    hound: houndCopy,
    logger: loggerCopy,
    time: timeCopy
}
export = copy;