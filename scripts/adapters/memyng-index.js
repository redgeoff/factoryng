'use strict';

var angular = require('../angular');
var factoryng = require('../index.js');

var app = angular.module('factoryng');

app.factory('Memyng', ['$q', '$timeout', require('./memyng')]);