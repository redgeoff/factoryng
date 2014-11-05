'use strict';

var Q = require('q'), YngUtils = require('../../scripts/yng-utils'), yngutils = new YngUtils(Q);

var utils = function () {};

// Usage: timeout(fn, ms), timeout(fn) or timeout(ms)
utils.timeout = function (fn, ms) {
  var defer = Q.defer();
  if (!yngutils.isFunction(fn)) {
    ms = fn;
  }
  setTimeout(function () {
    if (yngutils.isFunction(fn)) {
      try {
        defer.resolve(fn());
      } catch (err) {
        defer.reject(err);
      }
    } else {
      defer.resolve();
    }
  }, ms);
  return defer.promise;
};

module.exports = utils;