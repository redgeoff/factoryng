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
'use strict';

/* global EventEmitter */

angular.module('factoryng')
  .factory('Yng', ['$timeout', '$q', 'yngutils', function ($timeout, $q, yngutils) {

    var id = 0;

    var Yng = function (name, url, sortBy) {
      this.name = name;
      this.url = url;
      this.sortBy = sortBy;
      this.model = [];
      this.map = {};
      this.sorting = false;
      this.scope = null;
    };

    // We define our own event emitter instead of using angular's as it is possible that two
    // different adapters are bound to the same scope and we wouldn't want to have their events
    // interfere with each other.
    Yng.prototype = new EventEmitter();

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

        'on',
        'once',
        'removeListener'
      ];
      yngutils.copyFns(fns, this, obj);
    };

    return Yng;    
  }]);
// Prevent undefined module error when including event.js

/* jshint ignore:start */

/* istanbul ignore next */
if (!module) {
  var module = {};
}

/* jshint ignore:end */
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}
