
var headers = require('../../src/helpers/constants').HEADERS;

var createDataSheet = function (name, file, headers) {
  function Row() {
    var i = 0;
    for (var key in headers) {
      var rowName = headers[key];
      this[rowName] = arguments[i] || '';
      i++;
    }
    this.save = function(cb) {
      cb();
    };
    this.del = function(cb) {
      cb();
    };
  }

  rows = [];
  require('./mocked/mocked_' + file + '.json').forEach(function (element, index, arr) {
    args = [];
    for (var key in element) {
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
      var size = this._rows.length;
      this._rows.push(row);
      if (this._rows.length !== size + 1) {
        cb(new Error('Row was not added'));
      }
      cb();
    }
  }
};


var createRawDataSheet = function () { return createDataSheet('Raw Data', 'rawdata', headers.rawdata); };
var createPayrollReportSheet = function () { return createDataSheet('Payroll Reports', 'payroll', headers.payrollreports); };
var createEmployeeSheet = function () { return createDataSheet('Employees', 'employees', headers.users); };
var createVariableSheet = function () { return createDataSheet('Variables', 'variables', headers.variables); };
var createProjectsSheet = function () { return createDataSheet('Projects', 'projects', headers.projects); };
var createEventsSheet = function () { return createDataSheet('Events', 'events', headers.events); };

var mockSpreadsheet = {
  title: '',
  id: '',
  worksheets: [
    createRawDataSheet(),
    createPayrollReportSheet(),
    createEmployeeSheet(),
    createVariableSheet(),
    createProjectsSheet(),
    createEventsSheet()
  ]
};

var mockGoogleSpreadsheet = {
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
