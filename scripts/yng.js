'use strict';

var inherits = require('inherits'), EventEmitter = require('events').EventEmitter,
  YngUtils = require('./yng-utils');

module.exports = function ($q, $timeout) {
  var id = 0, yngutils = new YngUtils($q);

  var Yng = function (name, url, sortBy) {
    this.name = name;
    this.url = url;
    this.sortBy = sortBy;
    this.model = [];
    this.map = {};
    this.sorting = false;
    this.scope = null;
    this.props = {};
  };

  // We define our own event emitter instead of using angular's as it is possible that two
  // different adapters are bound to the same scope and we wouldn't want to have their events
  // interfere with each other.
  inherits(Yng, EventEmitter);

  // delay to minimize sorting while receiving multiple $priority updates
  var SORT_AFTER_MS = 100;

  var orderBy = function (direction) {
    return function (a, b) {
      var s = a.$priority - b.$priority;
      return direction === yngutils.DESC ? -s : s;
    };
  };

  Yng.prototype.sortIfNeeded = function () {
    if (this.sortBy) {
     this.model.sort(this.sortBy === yngutils.ASC || this.sortBy === yngutils.DESC ?
       orderBy(this.sortBy) : this.sortBy);
    }
  };

  Yng.prototype.sortSoonIfNeeded = function () {
    if (!this.sorting) {
      this.sorting = true;
      var that = this;
      $timeout(function () {
        that.sortIfNeeded();
        that.sorting = false;
      }, SORT_AFTER_MS);
    }
  };

  Yng.prototype.get = function (id) {
    return this.map[id];
  };

  Yng.prototype.at = function (index) {
    return this.model[index];
  };

  Yng.prototype.set = function (doc) {
    if (this.exists(doc.$id)) {
      // replace properties so that both map and model are updated simultaneously
      yngutils.replace(this.get(doc.$id), doc);
    }
  };

  Yng.prototype.setProperty = function (id, name, value) {
    this.map[id][name] = value;
  };

  Yng.prototype.exists = function (id) {
    return this.map[id] ? true : false;
  };

  Yng.prototype.push = function (doc) {
    if (!this.exists(doc.$id)) {
      this.map[doc.$id] = doc;
      this.model.push(doc);
    }
  };

  Yng.prototype.remove = function (id) {
    var doc = this.map[id];
    if (doc) {
      this.model.splice(this.model.indexOf(doc), 1);
      delete(this.map[id]);
    }
    return doc;
  };

  Yng.prototype.length = function () {
    return this.model.length;
  };

  Yng.prototype.bindModel = function (scope) {
    var that = this;
    return $timeout(function () {
      that.scope = scope;
      scope[that.name] = that.model;
      return that.model;
    });
  };

  Yng.prototype.bound = function () {
    return this.scope && this.scope[this.name] ? true : false;
  };

  Yng.prototype.applyFactory = function (fn) {
    var that = this;
    return function () {
      return fn.apply(that, arguments);
    };
  };

  Yng.prototype.createDoc = function (doc) {
    var that = this;
    return $timeout(function () {
      that.push(doc);
      that.emit('create', doc);
      return doc;
    });
  };

  Yng.prototype.updateDoc = function (doc) {
    var that = this;
    return $timeout(function () {
      that.set(doc);
      that.emit('update', doc);
      return doc;
    }); 
  };

  Yng.prototype.removeDoc = function (docOrId) {
    var that = this;
    return $timeout(function () {
      var id = that.toId(docOrId);
      var doc = that.remove(id);
      that.emit('remove', doc);
      return doc;
    });
  };

  Yng.prototype.moveDoc = function (doc) {
    var that = this;
    return $timeout(function () {
      if (that.get(doc.$id).$priority !== doc.$priority) { // priority changed?
        that.set(doc);
        that.sortSoonIfNeeded();
      }
      that.emit('move', doc);
      return doc;
    }); 
  };

  Yng.prototype.setPriorityIfNeeded = function (doc) {
    if (yngutils.notDefined(doc.$priority)) {
      doc.$priority = this.length();
    }
  };

  Yng.prototype.toId = function (docOrId) {
    var id = yngutils.isString(docOrId) || yngutils.isNumeric(docOrId) ? docOrId : docOrId.$id;
    if (yngutils.notDefined(id)) {
      throw new Error('missing $id');
    }
    return id;
  };

  Yng.prototype.forEach = function (callback, thisArg) {
    return this.model.forEach(callback, thisArg);
  };

  Yng.prototype.cleanup = function () {
    // A placeholder for adapters like Pouchyng so that cleanup can be done without an external
    // cron job
    return $q.when();
  };

  Yng.prototype.provider = function () {
    return null;
  };

  // preserveRemote should be used by adapters to destroy the adapter without destroying the
  // remote store when applicable
  Yng.prototype.destroy = function (/* preserveRemote */) {
    this.removeAllListeners();
    this.model = [];
    this.map = {};
    return $q.when();
  };

  Yng.prototype.error = function (err) {
    this.emit('error', err);
  };

  Yng.prototype.nextId = function () {
    return ++id;
  };

  Yng.prototype.properties = function (properties) {
    if (typeof properties === 'undefined') {
      return this.props;
    } else {
      this.props = properties;
    }
  };

  Yng.prototype.copyApi = function (obj) {
    var fns = [
      'sortIfNeeded',
      'sortSoonIfNeeded',
      'get',
      'at',
      'set',
      'setProperty',
      'exists',
      'push',
      'remove',
      'length',
      'forEach',
      'cleanup',
      'provider',
      'destroy',
      'bound',
      'properties',

      'on',
      'once',
      'removeListener'
    ];
    yngutils.copyFns(fns, this, obj);
  };

  return Yng;    
};