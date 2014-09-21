'use strict';

angular.module('factoryng', [])
  .service('yngutils', ['$q', function ($q) {

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

    this.copyFns = function (fns, from, to) {
      fns.forEach(function (el) {
        to[el] = function () {
          return from[el].apply(from, arguments);
        };
      });
    };

    this.forEach = function(obj, callback) {
      for (var i in obj) {
        /* istanbul ignore next */
        if (obj.hasOwnProperty(i)) {
          callback(obj[i], i, obj);
        }
      }
    };

    // Binds to event, executes action, after action finished resolves when event emitted
    // -->resolves({ action: actionArgs, event: eventArgs })
    this.doAndOnce = function (actionFactory, event, emitter) {
      var actionDefer = $q.defer(), eventDefer = $q.defer();
      emitter.once(event, function () {
        var eventArgs = arguments;
        return actionDefer.promise.then(function (actionArgs) {
          eventDefer.resolve({ action: actionArgs, event: eventArgs });
        });
      });
      return actionFactory().then(function () {
        actionDefer.resolve(arguments);
        return eventDefer.promise;
      });
    };

  }]);