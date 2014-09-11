'use strict';

angular.module('factoryng', [])
  .service('yngutils', function () {

    this.ASC = 1;
    this.DESC = 2;

    this.replace = function (oldDoc, newDoc) {
      for (var i in oldDoc) {
        if (this.notDefined(newDoc[i])) { // attr in oldDoc that is not in newDoc?
          delete(oldDoc[i]);
        }
      }
      for (i in newDoc) {
        oldDoc[i] = newDoc[i];  
      }
    };

    this.isString = function (obj) {
      return typeof obj === 'string' || obj instanceof String;
    };

    this.isNumeric = function (obj) {
      return !isNaN(obj);
    };

    this.notDefined = function (obj) {
      return typeof obj === 'undefined';
    };

    this.isFunction = function (obj) {
      return typeof obj === 'function';
    };

    this.clone = function (obj) {
      return JSON.parse(JSON.stringify(obj));
    };
  });