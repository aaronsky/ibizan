
const { HEADERS } = require('../../app/shared/rows');

function createDataSheet (name, file, headers) {
  function Row() {
    let i = 0;
    for (let key in headers) {
      const rowName = headers[key];
      this[rowName] = arguments[i] || '';
      i += 1;
    }
    this.save = function(cb) {
      cb();
    };
    this.del = function(cb) {
      cb();
    };
  }

  const rows = [];
  require('./mocked/mocked_' + file + '.json').forEach(function (element, index, arr) {
    const args = [];
    for (let key in element) {
      args.push(element[key]);
    }
    rows.push(new (function () { Row.apply(this, args); }));
  });
  return {
    title: name,
    _rows: rows,
    getRows: function (params, cb) {
      if (params && !cb && typeof params === 'function') {
        cb = params;
      }
      if (!(this._rows)) {
        cb(new Error('Sheet rows undefined'));
      }
      cb(null, this._rows);
    },
    addRow: function (row, cb) {
      if (!row) {
        cb(new Error('No row passed'));
      } else if (!(this._rows)) {
        cb(new Error('Sheet rows undefined'));
      }
      row.save = function(cb) {
        cb();
      };
      row.del = function(cb) {
        cb();
      };
      const size = this._rows.length;
      this._rows.push(row);
      if (this._rows.length !== size + 1) {
        cb(new Error('Row was not added'));
      }
      cb();
    }
  }
}

const createRawDataSheet = function () { return createDataSheet('Raw Data', 'rawdata', HEADERS.rawdata); };
const createPayrollReportSheet = function () { return createDataSheet('Payroll Reports', 'payroll', HEADERS.payrollreports); };
const createEmployeeSheet = function () { return createDataSheet('Employees', 'employees', HEADERS.users); };
const createVariableSheet = function () { return createDataSheet('Variables', 'variables', HEADERS.variables); };
const createProjectsSheet = function () { return createDataSheet('Projects', 'projects', HEADERS.projects); };
const createEventsSheet = function () { return createDataSheet('Events', 'events', HEADERS.events); };

const mockSpreadsheet = {
  title: 'test sheet',
  id: 'test',
  worksheets: [
    createRawDataSheet(),
    createPayrollReportSheet(),
    createEmployeeSheet(),
    createVariableSheet(),
    createProjectsSheet(),
    createEventsSheet()
  ]
};

const mockGoogleSpreadsheet = {
  _mockSpreadsheet: mockSpreadsheet,
  useServiceAccountAuth: function (auth, cb) {
    if (auth.client_email && auth.private_key) {
      cb();
    } else {
      cb(new Error('Authorization failed: Either client email or private key weren\'t passed in auth object'));
    }
  },
  getInfo: function (cb) {
    //pass error some day
    cb(null, this._mockSpreadsheet);
  }
};

module.exports = mockGoogleSpreadsheet;