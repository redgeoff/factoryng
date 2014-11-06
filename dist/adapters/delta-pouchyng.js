(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
module.exports=require(1)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/browserify/lib/_empty.js":1}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(require,module,exports){
'use strict';

var utils = require('./pouch-utils'); // TODO: is it ok that this causes warnings with uglifyjs??
var Promise = utils.Promise;

var events = require('events');

function empty(obj) {
  for (var i in obj) { // jshint unused:false
    return false;
  }
  return true;
}

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function isNumeric(obj) {
  return !isNaN(obj);
}

function notDefined(obj) {
  return typeof obj === 'undefined';
}

exports.delta = new events.EventEmitter();

exports.deltaInit = function () {
  this.on('create', function (object) {
    onCreate(this, object);
  });
  this.on('destroyed', function () {
    onDestroyed(this);
  });
};

exports.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

exports.merge = function (obj1, obj2) {
  var merged = {};
  for (var i in obj1) {
    merged[i] = obj1[i];
  }
  for (i in obj2) {
    merged[i] = obj2[i];
  }
  return merged;
};

function save(db, doc) {
  delete(doc._rev); // delete any revision numbers copied from previous docs
  doc.$createdAt = (new Date()).toJSON();
  if (doc.$id) { // update?
    // this format guarantees the docs will be retrieved in order they were created
    doc._id = doc.$id + '_' + doc.$createdAt;
    return db.put(doc).then(function (response) {
      response.$id = doc.$id;
      return response;
    })["catch"](/* istanbul ignore next */ function (err) {
      // It appears there is a bug in pouch that causes a doc conflict even though we are creating a
      // new doc
      if (err.status !== 409) {
        throw err;
      }
    });
  } else { // new
    return db.post(doc).then(function (response) {
      response.$id = response.id;
      return response;
    });
  }
}

exports.save = function (doc) {
  return save(this, doc);
};

exports["delete"] = function (docOrId) {
  var id = isString(docOrId) || isNumeric(docOrId) ? docOrId : docOrId.$id;
  if (notDefined(id)) {
    throw new Error('missing $id');
  }
  return save(this, {$id: id, $deleted: true});
};

exports.all = function () {
  var db = this;
  var docs = {},
    deletions = {};
  return db.allDocs({include_docs: true}).then(function (doc) {
    doc.rows.forEach(function (el) {
      if (!el.doc.$id) { // first delta for doc?
        el.doc.$id = el.doc._id;
      }
      if (el.doc.$deleted) { // deleted?
        delete(docs[el.doc.$id]);
        deletions[el.doc.$id] = true;
      } else if (!deletions[el.doc.$id]) { // update before any deletion?
        if (docs[el.doc.$id]) { // exists?
          docs[el.doc.$id] = exports.merge(docs[el.doc.$id], el.doc);
        } else {
          docs[el.doc.$id] = el.doc;
        }
      }
    });
    return docs;
  });
};

var deletions = {};

exports.wasDeleted = function (id) {
  return deletions[id] ? true : false;
};

exports.markDeletion = function (id) {
  deletions[id] = true;
};

function onCreate(db, object) {
  db.get(object.id).then(function (doc) {
    var id = doc.$id ? doc.$id : doc._id;
    if (!exports.wasDeleted(id)) { // not previously deleted?
      if (doc.$deleted) { // deleted?
        exports.markDeletion(id);
        exports.delta.emit('delete', id);
      } else if (doc.$id) { // update?
        exports.delta.emit('update', doc);
      } else {
        doc.$id = id;
        exports.delta.emit('create', doc);
      }
    }
  });
}

function onDestroyed(db) {
  db.delta.removeAllListeners();
}

function getChanges(oldDoc, newDoc) {
  var changes = {}, change = false;
  for (var i in newDoc) {
    if (oldDoc[i] !== newDoc[i]) {
      change = true;
      changes[i] = newDoc[i];
    }
  }
  return change ? changes : null;
}

exports.saveChanges = function (oldDoc, newDoc) {
  var db = this, changes = getChanges(oldDoc, newDoc);
  if (changes !== null) {
    changes.$id = oldDoc.$id;
    return db.save(changes).then(function () {
      return changes;
    });
  }
  return Promise.resolve();
};

function getAndRemove(db, id) {
  return db.get(id).then(function (object) {
    return db.remove(object);
  })["catch"](function (err) {
    // If the doc isn't found, no biggie. Else throw.
    /* istanbul ignore if */
    if (err.status !== 404) {
      throw err;
    }
  });
}

exports.getAndRemove = function (id) {
  return getAndRemove(this, id);
};

/*
 * We need a second pass for deletions as client 1 may delete and then
 * client 2 updates afterwards
 * e.g. {id: 1, title: 'one'}, {$id: 1, $deleted: true}, {$id: 1, title: 'two'}
 */
function removeDeletions(db, doc, deletions) {
  var promises = [];
  doc.rows.forEach(function (el) {
    if (deletions[el.doc.$id]) { // deleted?
      promises.push(getAndRemove(db, el.id));
    }
  });
  // promise shouldn't resolve until all deletions have completed
  return Promise.all(promises);
}

function cleanupDoc(db, el, docs, deletions) {
  return db.get(el.doc._id).then(function (object) {

    if (!el.doc.$id) { // first delta for doc?
      el.doc.$id = el.doc._id;
    }

    if (el.doc.$deleted || deletions[el.doc.$id]) { // deleted?
      deletions[el.doc.$id] = true;
      return db.remove(object);
    } else if (docs[el.doc.$id]) { // exists?
      var undef = false;
      for (var k in el.doc) {
        if (typeof docs[el.doc.$id][k] === 'undefined') {
          undef = true;
          break;
        }
      }
      if (undef) {
        docs[el.doc.$id] = exports.merge(docs[el.doc.$id], el.doc);
      } else { // duplicate update, remove
        return db.remove(object);
      }
    } else {
      docs[el.doc.$id] = el.doc;
    }
  });
}

// TODO: also create fn like noBufferCleanup that uses REST to cleanup??
//       This way can use timestamp so not cleaning same range each time
exports.cleanup = function () {
  var db = this;
  return db.allDocs({ include_docs: true }).then(function (doc) {

    var docs = {}, deletions = {}, chain = Promise.resolve();

    // reverse sort by createdAt
    doc.rows.sort(function (a, b) {
      return a.doc.$createdAt < b.doc.$createdAt;
    });

    // The cleanupDoc() calls must execute in sequential order
    doc.rows.forEach(function (el) {
      chain = chain.then(function () { return cleanupDoc(db, el, docs, deletions); });
    });

    return chain.then(function () {
      if (!empty(deletions)) {
        return removeDeletions(db, doc, deletions);
      }
    });

  });
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}

},{"./pouch-utils":23,"events":24}],5:[function(require,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],6:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = all;
function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len & !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9,"./reject":12,"./resolve":13}],7:[function(require,module,exports){
'use strict';
var tryCatch = require('./tryCatch');
var resolveThenable = require('./resolveThenable');
var states = require('./states');

exports.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return exports.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    resolveThenable.safely(self, thenable);
  } else {
    self.state = states.FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
exports.reject = function (self, error) {
  self.state = states.REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{"./resolveThenable":14,"./states":15,"./tryCatch":16}],8:[function(require,module,exports){
module.exports = exports = require('./promise');

exports.resolve = require('./resolve');
exports.reject = require('./reject');
exports.all = require('./all');
exports.race = require('./race');
},{"./all":6,"./promise":9,"./race":11,"./reject":12,"./resolve":13}],9:[function(require,module,exports){
'use strict';

var unwrap = require('./unwrap');
var INTERNAL = require('./INTERNAL');
var resolveThenable = require('./resolveThenable');
var states = require('./states');
var QueueItem = require('./queueItem');

module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('reslover must be a function');
  }
  this.state = states.PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    resolveThenable.safely(this, resolver);
  }
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
    typeof onRejected !== 'function' && this.state === states.REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  
  if (this.state !== states.PENDING) {
    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};

},{"./INTERNAL":5,"./queueItem":10,"./resolveThenable":14,"./states":15,"./unwrap":17}],10:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var unwrap = require('./unwrap');

module.exports = QueueItem;
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
},{"./handlers":7,"./unwrap":17}],11:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = race;
function race(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9,"./reject":12,"./resolve":13}],12:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9}],13:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = resolve;

var FALSE = handlers.resolve(new Promise(INTERNAL), false);
var NULL = handlers.resolve(new Promise(INTERNAL), null);
var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');

function resolve(value) {
  if (value) {
    if (value instanceof Promise) {
      return value;
    }
    return handlers.resolve(new Promise(INTERNAL), value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9}],14:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var tryCatch = require('./tryCatch');
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }
  
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}
exports.safely = safelyResolveThenable;
},{"./handlers":7,"./tryCatch":16}],15:[function(require,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],16:[function(require,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],17:[function(require,module,exports){
'use strict';

var immediate = require('immediate');
var handlers = require('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":7,"immediate":18}],18:[function(require,module,exports){
'use strict';
var types = [
  require('./nextTick'),
  require('./mutation.js'),
  require('./messageChannel'),
  require('./stateChange'),
  require('./timeout')
];
var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}
var scheduleDrain;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i] && types[i].test && types[i].test()) {
    scheduleDrain = types[i].install(nextTick);
    break;
  }
}
module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}
},{"./messageChannel":19,"./mutation.js":20,"./nextTick":2,"./stateChange":21,"./timeout":22}],19:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  if (global.setImmediate) {
    // we can only get here in IE10
    // which doesn't handel postMessage well
    return false;
  }
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],20:[function(require,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],21:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],22:[function(require,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],23:[function(require,module,exports){
(function (process,global){
'use strict';

var Promise;
/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  Promise = window.PouchDB.utils.Promise;
} else {
  Promise = typeof global.Promise === 'function' ? global.Promise : require('lie');
}
/* istanbul ignore next */
exports.once = function (fun) {
  var called = false;
  return exports.getArguments(function (args) {
    if (called) {
      console.trace();
      throw new Error('once called  more than once');
    } else {
      called = true;
      fun.apply(this, args);
    }
  });
};
/* istanbul ignore next */
exports.getArguments = function (fun) {
  return function () {
    var len = arguments.length;
    var args = new Array(len);
    var i = -1;
    while (++i < len) {
      args[i] = arguments[i];
    }
    return fun.call(this, args);
  };
};
/* istanbul ignore next */
exports.toPromise = function (func) {
  //create the function we will be returning
  return exports.getArguments(function (args) {
    var self = this;
    var tempCB = (typeof args[args.length - 1] === 'function') ? args.pop() : false;
    // if the last argument is a function, assume its a callback
    var usedCB;
    if (tempCB) {
      // if it was a callback, create a new callback which calls it,
      // but do so async so we don't trap any errors
      usedCB = function (err, resp) {
        process.nextTick(function () {
          tempCB(err, resp);
        });
      };
    }
    var promise = new Promise(function (fulfill, reject) {
      try {
        var callback = exports.once(function (err, mesg) {
          if (err) {
            reject(err);
          } else {
            fulfill(mesg);
          }
        });
        // create a callback for this invocation
        // apply the function in the orig context
        args.push(callback);
        func.apply(self, args);
      } catch (e) {
        reject(e);
      }
    });
    // if there is a callback, call it back
    if (usedCB) {
      promise.then(function (result) {
        usedCB(null, result);
      }, usedCB);
    }
    promise.cancel = function () {
      return this;
    };
    return promise;
  });
};

exports.inherits = require('inherits');
exports.Promise = Promise;

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":3,"inherits":25,"lie":8}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],26:[function(require,module,exports){
'use strict';

var utils = require('./pouch-utils');
var events = require('events');

// Note: using retry ideas similar to npm-browser (https://github.com/pouchdb/npm-browser)
var STARTING_RETRY_TIMEOUT = 1000;
var MAX_TIMEOUT = 300000; // 5 mins
var BACKOFF = 1.1;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function merge(obj1, obj2) {
  var merged = {}, i;
  /* istanbul ignore next */
  if (obj1) {
    for (i in obj1) {
      merged[i] = obj1[i];
    }
  }
  /* istanbul ignore next */
  if (obj2) {
    for (i in obj2) {
      merged[i] = obj2[i];
    }
  }
  return merged;
}

// Supported options:
//  url, startingTimeout, maxTimeout, backoff, manual
//  changes.opts
//  to.url, to.onErr, to.listeners, to.opts
//  from.url, from.onErr, from.listeners, from.opts

exports.persist = function (opts) {
  var db = this;

  var per = new events.EventEmitter();

  per.TO = 1;
  per.FROM = 2;
  per.BOTH = 3;

  per.opts = { changes: {}, to: {}, from: {} }; // init to prevent undefined errors
  per.config = function (opts) {
    for (var i in opts) {
      per.opts[i] = opts[i];
    }
  };
  if (opts) {
    per.config(opts);
  }

  per.startingTimeout = opts && opts.startingTimeout ? opts.startingTimeout: STARTING_RETRY_TIMEOUT;
  per.maxTimeout = opts && opts.maxTimeout ? opts.maxTimeout: MAX_TIMEOUT;
  per.backoff = opts && opts.backoff ? opts.backoff : BACKOFF;
  per.connected = false;

  var vars = {
    retryTimeout: per.startingTimeout,
    replicating: false,
    connected: false
  };

  var state = {}, replicating = false;
  state[per.TO] = vars;
  state[per.FROM] = clone(vars);

  function setup() {
    return db.info().then(function (info) {
      var d = per.opts.changes,
          opts = { since: info.update_seq, live: true };
      if (d.opts) {
        opts = merge(opts, d.opts);
      }
      per.changes = db.changes(opts);
    });
  }

  function addListeners(emitter, listeners) {
    listeners.forEach(function (listener) {
      var fn = emitter[listener['method']];
      fn.call(emitter, listener['event'], listener['listener']);
    });
  }

  // TODO: override window.XMLHttpRequest to test the following
  /* istanbul ignore next */
  function backoff(retryTimeout) {
    return Math.min(per.maxTimeout, Math.floor(retryTimeout * per.backoff)); // exponential backoff
  }

  function disconnect() {
    per.connected = false;
    per.emit('disconnect');
  }

  // TODO: override window.XMLHttpRequest to test the following
  /* istanbul ignore next */
  function onError(err, direction) {
    if (err.status === 405) { // unknown error
      var s = state[direction];
      s.connected = false;
      s.retryTimeout = backoff(s.retryTimeout);
      setTimeout(direction === per.TO ? replicateTo : replicateFrom, s.retryTimeout);
      if (per.connected) {
        disconnect();
      }
    }
  }

  function connect() {
    per.connected = true;
    per.emit('connect');
  }

  function onConnect(direction) {
    var s = state[direction];
    s.connected = true;
    s.retryTimeout = per.startingTimeout;
    removeConnectListeners(direction);
    if (state[per.TO].connected && state[per.FROM].connected) {
      connect();
    }
  }

  function removeConnectListeners(direction) {
    var emitter = direction === per.TO ? per.to : per.from;
    var connectListener = state[direction].connectListener;
    emitter.removeListener('change', connectListener);
    emitter.removeListener('complete', connectListener);
    emitter.removeListener('uptodate', connectListener);
  }

  function registerListeners(emitter, direction, listeners) {

    // TODO: override window.XMLHttpRequest to test the following
    /* istanbul ignore next */
    emitter.on('error', function (err) {
      onError(err, direction);
    });

    state[direction].connectListener = function () {
      onConnect(direction);
    };
    var connectListener = state[direction].connectListener;
    emitter.once('change', connectListener)
           .once('complete', connectListener)
           .once('uptodate', connectListener);

    if (listeners) {
      addListeners(emitter, listeners);
    }
  }

  function replicate(direction) {
    var d = direction === per.TO ? per.opts.to : per.opts.from,
        method = direction === per.TO ? db.replicate.to : db.replicate.from;

    var opts = { live: true }, url = d.url ? d.url : per.opts.url;

    if (d.opts) {
      opts = merge(opts, d.opts);
    }

    if (direction === per.TO) {
      cancelTo();
    } else {
      cancelFrom();
    }

    var emitter = method(url, opts, d.onErr);

    if (direction === per.TO) {
      per.to = emitter;
    } else {
      per.from = emitter;
    }

    registerListeners(emitter, direction, d.listeners);
  }

  function replicateTo() {
    replicate(per.TO);
  }

  function replicateFrom() {
    replicate(per.FROM);
  }

  function startReplication(direction) {
    if (!state[per.TO].replicating && (direction === per.BOTH || direction === per.TO)) {
      state[per.TO].replicating = true;
      replicateTo();
    }
    if (!state[per.FROM].replicating && (direction === per.BOTH || direction === per.FROM)) {
      state[per.FROM].replicating = true;
      replicateFrom();
    }
  }

  per.start = function (direction) {
    direction = direction ? direction : per.BOTH;
    if (!replicating) {
      return setup().then(function () {
        replicating = true;
        startReplication(direction);
      });
    } else {
      return new utils.Promise(function () {
        startReplication(direction);
      });
    }
  };

  function cancelChanges() {
    if (per.changes) {
      per.changes.cancel();
    }
  }

  function cancelTo() {
    if (per.to) {
      per.to.cancel();
    }
  }

  function cancelFrom() {
    if (per.from) {
      per.from.cancel();
    }
  }

  per.cancel = function () {
    cancelChanges();
    cancelTo();
    cancelFrom();
  };

  per.stop = function (direction) {
    direction = direction ? direction : per.BOTH;
    if (direction === per.BOTH || direction === per.TO) {
      state[per.TO].replicating = false;
      state[per.TO].connected = false;
      cancelTo();
    }
    if (direction === per.BOTH || direction === per.FROM) {
      state[per.FROM].replicating = false;
      state[per.FROM].connected = false;
      cancelFrom();
    }
    if (!state[per.TO].replicating && !state[per.FROM].replicating) {
      cancelChanges();
    }
    disconnect();
  };

  if (opts && !opts.manual) {
    per.start();
  }

  return per;
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}

},{"./pouch-utils":45,"events":24}],27:[function(require,module,exports){
module.exports=require(5)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/INTERNAL.js":5}],28:[function(require,module,exports){
module.exports=require(6)
},{"./INTERNAL":27,"./handlers":29,"./promise":31,"./reject":34,"./resolve":35,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/all.js":6}],29:[function(require,module,exports){
module.exports=require(7)
},{"./resolveThenable":36,"./states":37,"./tryCatch":38,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/handlers.js":7}],30:[function(require,module,exports){
module.exports=require(8)
},{"./all":28,"./promise":31,"./race":33,"./reject":34,"./resolve":35,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/index.js":8}],31:[function(require,module,exports){
module.exports=require(9)
},{"./INTERNAL":27,"./queueItem":32,"./resolveThenable":36,"./states":37,"./unwrap":39,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/promise.js":9}],32:[function(require,module,exports){
module.exports=require(10)
},{"./handlers":29,"./unwrap":39,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/queueItem.js":10}],33:[function(require,module,exports){
module.exports=require(11)
},{"./INTERNAL":27,"./handlers":29,"./promise":31,"./reject":34,"./resolve":35,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/race.js":11}],34:[function(require,module,exports){
module.exports=require(12)
},{"./INTERNAL":27,"./handlers":29,"./promise":31,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/reject.js":12}],35:[function(require,module,exports){
module.exports=require(13)
},{"./INTERNAL":27,"./handlers":29,"./promise":31,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/resolve.js":13}],36:[function(require,module,exports){
module.exports=require(14)
},{"./handlers":29,"./tryCatch":38,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/resolveThenable.js":14}],37:[function(require,module,exports){
module.exports=require(15)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/states.js":15}],38:[function(require,module,exports){
module.exports=require(16)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/tryCatch.js":16}],39:[function(require,module,exports){
module.exports=require(17)
},{"./handlers":29,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/lib/unwrap.js":17,"immediate":40}],40:[function(require,module,exports){
module.exports=require(18)
},{"./messageChannel":41,"./mutation.js":42,"./nextTick":2,"./stateChange":43,"./timeout":44,"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/node_modules/immediate/lib/index.js":18}],41:[function(require,module,exports){
module.exports=require(19)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/node_modules/immediate/lib/messageChannel.js":19}],42:[function(require,module,exports){
module.exports=require(20)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/node_modules/immediate/lib/mutation.js":20}],43:[function(require,module,exports){
module.exports=require(21)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/node_modules/immediate/lib/stateChange.js":21}],44:[function(require,module,exports){
module.exports=require(22)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/node_modules/lie/node_modules/immediate/lib/timeout.js":22}],45:[function(require,module,exports){
module.exports=require(23)
},{"/Users/geoffreycox/Documents/nobkup/factoryng/node_modules/delta-pouch/pouch-utils.js":23,"_process":3,"inherits":25,"lie":30}],46:[function(require,module,exports){
'use strict';

var angular = require('../angular');
var factoryng = require('../index.js');

var app = angular.module('factoryng');

app.factory('DeltaPouchyng', ['$q', '$timeout', require('./delta-pouchyng')]);
},{"../angular":49,"../index.js":50,"./delta-pouchyng":47}],47:[function(require,module,exports){
// TODO: Option to enable encryption that uses filter pouch

'use strict';

var YngUtils = require('../yng-utils'), PouchyngCommonFactory = require('./pouchyng-common'),
    DeltaPouch = require('delta-pouch');

module.exports = function ($q, $timeout) {
  var PouchyngCommon = new PouchyngCommonFactory($q, $timeout), yngutils = new YngUtils($q);

  // TODO: why can't we just do var PouchDB = require('pouchdb')
  // Need to require here in case pouch lazy loaded
  /* istanbul ignore next */
  if (typeof window === 'undefined' || !window.PouchDB) {
    var PouchDB = require('pouchdb');
  } else {
    var PouchDB = window.PouchDB;
  }

  PouchDB.plugin(DeltaPouch);

  return function (name, url, sortBy) {

    var common = new PouchyngCommon(name, url, sortBy, 'deltapouchyng');
    common.copyApi(this);

    common.map = function () {
      return common.db.all().then(function (docs) {
        yngutils.forEach(docs, function (doc) {
          delete(doc._rev);
          common.yng.push(doc);
        });
      });
    };

    common.registerListeners = function () {
      var onDel = onDelete; // needed or else jshint reports onDelete not used
      common.db.deltaInit();
      common.db.delta.on('create', onCreate)
                     .on('update', onUpdate)
                     .on('delete', onDel);
    };

    this.create = function (doc) {
      return $timeout(function () {
        common.yng.setPriorityIfNeeded(doc);
        return common.db.save(doc).then(function (createdDoc) {
          doc.$id = createdDoc.$id;
          common.yng.push(doc);
          return doc;
        });
      });
    };

    this.update = function (doc) {
      return $timeout(function () {
        var oldDoc = common.yng.get(doc.$id);
        return common.db.saveChanges(oldDoc, doc).then(function (changes) {
          var newDoc = common.db.merge(oldDoc, changes);
          common.yng.set(newDoc);
          return doc;
        });
      });
    };

    this.remove = function (docOrId) {
      return $timeout(function () {
        return common.db["delete"](docOrId).then(function (deletedDoc) {
          return common.yng.remove(deletedDoc.$id);
        });
      });
    };

    this.setPriority = function (docOrId, priority) {
      return $timeout(function () {
        var id = common.yng.toId(docOrId), doc = common.yng.get(id);
        var newDoc = yngutils.clone(doc);
        newDoc.$priority = priority;
        return common.db.saveChanges(doc, newDoc).then(function (/* changes */) {
          // Need to trigger move event as pouchdb doesn't support separate move event and
          // otherwise we cannot determine if the update event was for a move
          common.yng.moveDoc(newDoc);
          return doc;
        });
      });
    };

    function onCreate(doc) {
      delete(doc._rev);
      common.yng.createDoc(doc);
    }

    function onUpdate(changes) {
      delete(changes._rev);
      var oldDoc = common.yng.get(changes.$id), newDoc = common.db.merge(oldDoc, changes);
      /* istanbul ignore if */
      if (newDoc.$priority !== oldDoc.$priority) {
        common.yng.moveDoc(newDoc);
      } else {
        common.yng.updateDoc(newDoc);
      }
    }

    function onDelete(id) {
      common.yng.removeDoc(id);
    }

    this.cleanup = function () {
      return common.db.cleanup();
    };

  };
};
},{"../yng-utils":51,"./pouchyng-common":48,"delta-pouch":4,"pouchdb":1}],48:[function(require,module,exports){
// TODO: Option to enable encryption that uses filter pouch

'use strict';

var YngUtils = require('../yng-utils'), YngFactory = require('../yng'),
    Persist = require('pouchdb-persist');

module.exports = function ($q, $timeout) {
  var Yng = new YngFactory($q, $timeout), yngutils = new YngUtils($q);

  // TODO: why can't we just do var PouchDB = require('pouchdb')
  // Need to require here in case pouch lazy loaded
  /* istanbul ignore next */
  if (typeof window === 'undefined' || !window.PouchDB) {
    var PouchDB = require('pouchdb');
  } else {
    var PouchDB = window.PouchDB;
  }

  PouchDB.plugin(Persist);

  return function (name, url, sortBy, suffix) {
    var that = this;
    this.yng = new Yng(name, url, sortBy);

    var config = {
      opts: {
        filter: function (doc) {
          // Ignore design docs by default
          return doc._id.indexOf('_design') !== 0;
        }
      }
    };
    this.yng.props = { changes: config, to: config, from: config };

    this.db = null;
    this.persist = null;

    // use a suffix as the name to prevent duplicate db names across adapters
    var dbName = that.yng.name + '_' + suffix;
    this.db = new PouchDB(dbName);

    this.provider = function () {
      return that.db;
    };

    this.bind = function (scope) {
      if (that.yng.bound()) { // already bound
        return that.yng.bindModel(scope);
      } else {
        // For some reason, pouch appears to require more event listeners than the default 11.
        // Pouch appears to register several 'destroyed' handlers. Is this really necessary?
        that.db.setMaxListeners(20);

        that.yng.scope = scope;
        that.db.on('error', that.yng.error);
        return $timeout(function () {
          return sync();
        });
      }
    };

    function syncError(err) {
      // Appears we need to ignore error events with null parameters
      /* istanbul ignore if */
      if (err) {
        that.yng.error(err);
      }
    }

    function onUpToDate() {
      that.yng.emit('uptodate');
    }

    function onLoadFactory(defer) {
      return function () {
        return that.map().then(function () {
          that.yng.sortIfNeeded();
          return that.yng.bindModel(that.yng.scope).then(defer.resolve);
        });
      };
    }

    function fromListeners(defer) {
      // If the local pouch database doesn't already exist then we need to wait for the
      // uptodate or error events before a call to allDocs() will return all the data in the
      // remote database.
      return [
        { method: 'once', event: 'uptodate', listener: onLoadFactory(defer) },
        { method: 'on', event: 'uptodate', listener: onUpToDate },
        { method: 'once', event: 'error', listener: onLoadFactory(defer) },
        { method: 'on', event: 'complete', listener: onUpToDate }
      ];
    }

    function sync() {
      var defer = $q.defer();
      that.persist = that.db.persist({
        url: that.yng.url + '/' +
            (yngutils.get(that.yng.props, 'user') ? that.yng.props.user : that.yng.name),
        manual: true,
        changes: {
          opts: yngutils.get(that.yng.props, 'changes', 'opts')
        },
        to: {
          opts: yngutils.get(that.yng.props, 'to', 'opts'),
          onErr: syncError
        },
        from: {
          opts: yngutils.get(that.yng.props, 'from', 'opts'),
          onErr: syncError,
          listeners: fromListeners(defer)
        }
      });
      that.registerListeners();
      that.persist.start();
      return defer.promise;
    }

    this.cancel = function () {
      this.persist.cancel();
    };

    function destroyRemoteDb () {
      // Calling db.destroy() only removes the local database, we need to remove the remote
      // database separately
      var remoteDb = new PouchDB(that.yng.url + '/' +
            (yngutils.get(that.yng.props, 'user') ? that.yng.props.user : that.yng.name));
      return yngutils.doAndOnce(function () {
        return remoteDb.destroy();
      }, 'destroyed', remoteDb);
    }

    this.destroy = function (preserveRemote) {
      that.cancel();

      var localPromise = yngutils.doAndOnce(function () {
        return that.db.destroy();
      }, 'destroyed', this.db);
      var promises = [localPromise];

      if (!preserveRemote) {
        promises.push(destroyRemoteDb());
      }

      return $q.all(promises).then(function () {
        return that.yng.destroy();
      });
    };

    this.copyApi = function (obj) {
      that.yng.copyApi(obj);

      var fns = [
        'provider',
        'bind',
        'destroy'
      ];
      yngutils.copyFns(fns, that, obj);
    };

  };
};
},{"../yng":52,"../yng-utils":51,"pouchdb":1,"pouchdb-persist":26}],49:[function(require,module,exports){
require('angular');

module.exports = angular;
},{"angular":1}],50:[function(require,module,exports){
'use strict';

var angular = require('./angular');

var app = angular.module('factoryng', []);

app.service('yngutils', ['$q', require('./yng-utils')]);

app.factory('Yng', ['$q', '$timeout', require('./yng')]);
},{"./angular":49,"./yng":52,"./yng-utils":51}],51:[function(require,module,exports){
'use strict';

module.exports = function ($q) {

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

  this.merge = function (obj1, obj2) {
    var merged = {}, i;
    if (obj1) {
      for (i in obj1) {
        merged[i] = obj1[i];
      }
    }
    if (obj2) {
      for (i in obj2) {
        merged[i] = obj2[i];
      }
    }
    return merged;
  };

  // Usage: get(object, key1 [, key2, ..., keyN])
  this.get = function () {
    if (!arguments || typeof arguments[0] === 'undefined') {
      return; // returns undefined
    }
    var items = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
      var k = arguments[i];
      if (items === null || typeof items[k] === 'undefined') {
        return;
      } else {
        items = items[k];
      }
    }
    return items;
  };

};
},{}],52:[function(require,module,exports){
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
},{"./yng-utils":51,"events":24,"inherits":25}]},{},[46]);
