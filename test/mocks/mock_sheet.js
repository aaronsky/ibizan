const path = require('path');
const fs = require('fs');
const { HEADERS } = require('../../app/shared/rows');

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
    }
  }
}

function getInfo(callback) {
  const response = {
    properties: {
      title: mockSpreadsheet.title
    },
    sheets: [
      {

      },
      {

      },
      {

      },
      {

      },
      {

      },
      {

      }
    ]
  }
  if (callback && typeof callback === 'function') {
    callback(response);
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

function parseRange(range) {
  // Sheet!ColRow:ColRow
  const [sheetName, cells] = range.split('!');
  let minCell, maxCell;
  if (cells) {
    [minCell, maxCell] = cells.split(':');
  }
  return [sheetName, minCell, maxCell];
}

const mockSpreadsheet = {
  title: 'test sheet',
  id: 'test',
  getSheet: (sheetName) => {
    if (!sheetName) {
      return worksheets[0];
    } else {
      if (sheetName === 'Variables') {
        return worksheets[0];
      } else if (sheetName === 'Projects') {
        return worksheets[1];
      } else if (sheetName === 'Raw Data') {
        return worksheets[2];
      } else if (sheetName === 'Employees') {
        return worksheets[3];
      } else if (sheetName === 'Payroll Reports') {
        return worksheets[4];
      } else if (sheetName === 'Events') {
        return worksheets[5];
      }
    }
  },
  worksheets: [
    createDataSheet.call(null, 'Variables', 'variables', HEADERS.rawdata),
    createDataSheet.call(null, 'Projects', 'projects', HEADERS.rawdata),
    createDataSheet.call(null, 'Raw Data', 'rawdata', HEADERS.rawdata),
    createDataSheet.call(null, 'Employees', 'users', HEADERS.rawdata),
    createDataSheet.call(null, 'Payroll Reports', 'payroll', HEADERS.rawdata),
    createDataSheet.call(null, 'Events', 'events', HEADERS.rawdata)
  ]
};

function createDataSheet(name, file, headers) {
  const model = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mocked', 'mocked_' + file + '.json'), 'utf-8'));
  model.name = name;
  model.getValues = (minCell, maxCell) => {
    let minCol, minRow, maxCol, maxRow;
    if (!minCell && !maxCell) {
      minCol = 0;
      minRow = 0;
      maxCol = this.length;
      maxRow = this[0].length;
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
        maxRow = ((+maxCell.replace(maxCell, '') - 1) || this[0].length);
      } else {
        maxRow = +maxCell || this.length;
      }
    }
    const values = [];
    for (let y = minRow; y < maxRow; y++) {
      const segment = [];
      for (let x = minCol; x < maxCol; x++) {
        segment.push(this[y][x]);
      }
      values.push(segment);
    }
  };
  return model;
}

module.exports = mockService;