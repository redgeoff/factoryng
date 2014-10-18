// TODO: Option to enable encryption that uses filter pouch

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('PouchyngCommon', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
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
        this.to = null;
        this.from = null;
        this.changes = null;

        // use a unique id as the name to prevent duplicate db names across adapters
        this.db = new PouchDB(that.yng.name + '_' + that.yng.nextId());

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

        function listenForChanges(info) {
          /* jshint camelcase: false */
          var chOpts = { since: info.update_seq, live: true };
          chOpts = yngutils.merge(chOpts, yngutils.get(that.yng.props, 'changes', 'opts'));
          that.changes = that.db.changes(chOpts);
        }

        function replicate(defer) {
          var toOpts = { live: true }, frOpts = toOpts,
              remoteCouch = that.yng.url + '/' +
                (yngutils.get(that.yng.props, 'user') ? that.yng.props.user : that.yng.name);
          toOpts = yngutils.merge(toOpts, yngutils.get(that.yng.props, 'to', 'opts'));
          frOpts = yngutils.merge(frOpts, yngutils.get(that.yng.props, 'from', 'opts'));

          // If the local pouch database doesn't already exist then we need to wait for the
          // uptodate or error events before a call to allDocs() will return all the data in the
          // remote database.
          that.to = that.db.replicate.to(remoteCouch, toOpts, syncError);
          that.from = that.db.replicate.from(remoteCouch, frOpts, syncError)
                             .once('uptodate', onLoadFactory(defer))
                             .on('uptodate', onUpToDate)
                             .once('error', onLoadFactory(defer))
                             .on('complete', onUpToDate);
        }

        function sync() {
          return that.db.info().then(function (info) {
            var defer = $q.defer();
            listenForChanges(info);
            that.registerListeners();
            replicate(defer);
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
  }]);