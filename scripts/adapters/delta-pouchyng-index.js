'use strict';

var angular = require('../angular');
var factoryng = require('../index.js');

var app = angular.module('factoryng');

app.factory('DeltaPouchyng', ['$q', '$timeout', require('./delta-pouchyng')]);