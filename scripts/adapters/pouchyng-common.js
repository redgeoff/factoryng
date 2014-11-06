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