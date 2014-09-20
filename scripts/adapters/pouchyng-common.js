// TODO: Option to enable encryption that uses filter pouch

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('PouchyngCommon', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
        var that = this;
        this.yng = new Yng(name, url, sortBy);
        this.db = null;
        this.to = null;
        this.from = null;
        this.changes = null;

        this.provider = function() {
          return that.db;
        };

        this.bind = function (scope) {
          if (that.db) { // already bound
            return that.yng.rebindModel(scope);
          } else {
            // use a unique id as the name to prevent duplicate db names across adapters
            that.db = new PouchDB(that.yng.name + '_' + that.yng.nextId());

            // For some reason, pouch appears to require more event listeners than the default 11.
            // Pouch appears to register several 'destroyed' handlers. Is this really necessary?
            that.db.setMaxListeners(20);

            that.yng.scope = scope;
            that.db.on('error', that.yng.error);
            return sync();
          }
        };

        function syncError(err) {
          // 405, 'Method Not Allowed' generated when DB first created and not really an error
          /* istanbul ignore next */
          if (err && err.status !== 405) {
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

        function sync() {
          return that.db.info().then(function (info) {
            var defer = $q.defer();
            /* jshint camelcase: false */
            that.changes = that.db.changes({
              since: info.update_seq,
              live: true
            });
            that.registerListeners();
            var opts = { live: true }, remoteCouch = that.yng.url + '/' + that.yng.name;
            that.to = that.db.replicate.to(remoteCouch, opts, syncError);
            that.from = that.db.replicate.from(remoteCouch, opts, syncError)
                               .once('uptodate', onLoadFactory(defer))
                               .on('uptodate', onUpToDate)
                               .once('error', onLoadFactory(defer))
                               .on('complete', onUpToDate);
            return defer.promise;
          });
        }

        this.cancel = function () {
          /* istanbul ignore next */
          if (that.changes) {
            that.changes.cancel();
          }
          /* istanbul ignore next */
          if (that.to) {
            that.to.cancel();
          }
          /* istanbul ignore next */
          if (that.from) {
            that.from.cancel();
          }
        };

        this.destroy = function (preserveRemote) {
          that.cancel();

          var localDefer = $q.defer();
          this.db.on('destroyed', function () {
            localDefer.resolve();
          });
          var promises = [that.db.destroy(), localDefer.promise];

          if (!preserveRemote) {
            // Calling db.destroy() only removes the local database, we need to remove the remote
            // database separately
            var remoteDb = new PouchDB(that.yng.url + '/' + that.yng.name);
            var remoteDefer = $q.defer();
            remoteDb.on('destroyed', function () {
              remoteDefer.resolve();
            });
            promises.push(remoteDb.destroy(), remoteDefer.promise);
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
  }]);