'use strict';

var chai = require('chai');
var mocks = require('./mocks');

global.expect = chai.expect;
global.assert = chai.assert;
global.MockSheet = mocks.MockSheet;
global.MockRobot = mocks.MockRobot;