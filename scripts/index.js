'use strict';

var angular = require('./angular');

var app = angular.module('factoryng', []);

app.service('yngutils', ['$q', require('./yng-utils')]);

app.factory('Yng', ['$q', '$timeout', require('./yng')]);