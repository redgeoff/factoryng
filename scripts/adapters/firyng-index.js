'use strict';

var angular = require('../angular');
var factoryng = require('../index.js');

var app = angular.module('factoryng');

app.factory('Firyng', ['$q', '$timeout', require('./firyng')]);