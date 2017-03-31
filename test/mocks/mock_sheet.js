const path = require('path');
const fs = require('fs');

const mockService = {
    spreadsheets: {
        create: (request, callback) => {
            fakeApiRequest('spreadsheets.create', request, callback);
        },
        get: (request, callback) => {
            fakeApiRequest('spreadsheets.get', request, callback);
        },
        sheets: {

        },
        values: {
            append: (request, callback) => {
                fakeApiRequest('spreadsheets.values.append', request, callback);
            },
            clear: (request, callback) => {
                fakeApiRequest('spreadsheets.values.clear', request, callback);
            },
            get: (request, callback) => {
                fakeApiRequest('spreadsheets.values.get', request, callback);
            },
            update: (request, callback) => {
                fakeApiRequest('spreadsheets.values.update', request, callback);
            }
        }
    }
}

function fakeApiRequest(apiMethod, request, callback) {
    let [domain, methodOrDomain, method] = apiMethod.split('.');
    if (!method) {
        method = methodOrDomain;
    } else {
        domain = methodOrDomain;
    }
    if (domain === 'spreadsheets') {
        if (method === 'get') {
            getInfo(callback);
        }
    } else if (domain === 'values') {
        if (method === 'get') {
            getValues(request.range, request.majorDimension, callback)
        } else if (method === 'append') {
            appendValues(request.range, request.values, request.majorDimension, callback);
        } else if (method === 'update') {
            updateValues(request.range, request.values, request.majorDimension, callback);
        } else if (method === 'clear') {
            clearValues(request.range, request.majorDimension, callback);
        }
    }
}

function getInfo(callback) {
    const response = require('./mocked/mocked_spreadsheet.json');
    if (callback && typeof callback === 'function') {
        callback(null, response);
    }
}

function getValues(range, dimension, callback) {
    if (!callback && dimension && typeof dimension === 'function') {
        callback = dimension;
        dimension = null;
    }
    const [sheet, minCell, maxCell] = parseRange(range);
    const worksheet = mockSpreadsheet.getSheet(sheet);
    const values = worksheet.getValues(minCell, maxCell);
    const response = {
        range: range,
        majorDimension: dimension || 'DIMENSION_UNSPECIFIED',
        values: values
    };
    if (callback && typeof callback === 'function') {
        callback(null, response);
    }
}

function appendValues(range, values, dimension, callback) {
    if (!callback && dimension && typeof dimension === 'function') {
        callback = dimension;
        dimension = null;
    }
    const response = {
        range: range,
        majorDimension: dimension || 'DIMENSION_UNSPECIFIED',
        values: values
    };
    if (callback && typeof callback === 'function') {
        callback(null, response);
    }
}

function updateValues(range, values, dimension, callback) {
    if (!callback && dimension && typeof dimension === 'function') {
        callback = dimension;
        dimension = null;
    }
    const response = {
        range: range,
        majorDimension: dimension || 'DIMENSION_UNSPECIFIED',
        values: values
    };
    if (callback && typeof callback === 'function') {
        callback(null, response);
    }
}

function clearValues(range, dimension, callback) {
    if (!callback && dimension && typeof dimension === 'function') {
        callback = dimension;
        dimension = null;
    }
    const response = {
        range: range,
    };
    if (callback && typeof callback === 'function') {
        callback(null, response);
    }
}

function parseRange(range) {
    // Sheet!ColRow:ColRow
    const [sheetName, cells] = range.split('!');
    let minCell, maxCell;
    if (cells) {
        [minCell, maxCell] = cells.split(':');
    }
    return [sheetName, minCell, maxCell];
}

function createDataSheet(name, file) {
    const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mocked', 'mocked_' + file + '.json'), 'utf-8'));
    const getValues = (minCell, maxCell) => {
        let minCol, minRow, maxCol, maxRow;
        if (!minCell && !maxCell) {
            minRow = 0;
            minCol = 0;
            maxRow = data.length;
            maxCol = data[0].length;
        } else {
            const columnRegex = /[A-Za-z]+/;
            let match = minCell.match(columnRegex);
            if (match && match[0]) {
                match = match[0].toUpperCase();
                minCol = match.charCodeAt(0) - 65;
                minRow = (+minCell.replace(minCol, '') || 1) - 1;
            } else {
                minRow = (+minCell || 1) - 1;
            }
            match = maxCell.match(columnRegex);
            if (match && match[0]) {
                match = match[0].toUpperCase();
                maxCol = match.charCodeAt(0) - 65;
                maxRow = ((+maxCell.replace(maxCell, '') - 1) || data[0].length);
            } else {
                maxRow = +maxCell || data.length;
            }
        }
        const values = [];
        for (let y = minRow; y < maxRow; y++) {
            if (!data[y]) {
                break;
            }
            const segment = [];
            for (let x = minCol; x < maxCol; x++) {
                segment.push(data[y][x] || "");
            }
            values.push(segment);
        }
        return values;
    };

    const sheet = {
        properties: {
            title: name
        },
        data,
        getValues
    };
    return sheet;
}

const variablesSheet = createDataSheet('Variables', 'variables');
const projectsSheet = createDataSheet('Projects', 'projects');
const rawDataSheet = createDataSheet('Raw Data', 'rawdata');
const employeesSheet = createDataSheet('Employees', 'users');
const eventsSheet = createDataSheet('Events', 'events');
const payrollSheet = createDataSheet('Payroll Reports', 'payroll');

const mockSpreadsheet = {
    title: 'test sheet',
    id: 'test',
    getSheet: (sheetName) => {
        if (!sheetName) {
            return variablesSheet;
        } else {
            if (sheetName === 'Variables') {
                return variablesSheet;
            } else if (sheetName === 'Projects') {
                return projectsSheet;
            } else if (sheetName === 'Raw Data') {
                return rawDataSheet;
            } else if (sheetName === 'Employees') {
                return employeesSheet;
            } else if (sheetName === 'Payroll Reports') {
                return payrollSheet;
            } else if (sheetName === 'Events') {
                return eventsSheet;
            }
        }
    }
};

const mockAuth = {

};

module.exports = {
    Service: mockService,
    Auth: mockAuth,
    getSheet: mockSpreadsheet.getSheet
};