// TODO: do we need to refactor so that can access provider before it is used, i.e. we can apply a
// plugin before the provider is used? Should we just expose something like newProvider? Really,
// this should sort of be hidden from the user as then the controller needs to understand logic
// about the adapter--however, this approach might be too controlling as someone might not want to
// have to develop a new adapter just to use a pouch plugin

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

        function destroyRemoteDb () {
          // Calling db.destroy() only removes the local database, we need to remove the remote
          // database separately
          var remoteDb = new PouchDB(that.yng.url + '/' + that.yng.name);
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
// TODO: Option to enable encryption that uses filter pouch

'use strict';

angular.module('factoryng')
  .factory('DeltaPouchyng', ['$q', '$timeout', 'Yng', 'yngutils', 'PouchyngCommon',
    function ($q, $timeout, Yng, yngutils, PouchyngCommon) {
      return function (name, url, sortBy) {
        var common = new PouchyngCommon(name, url, sortBy);
        common.copyApi(this);

        common.map = function () {
          return common.db.all().then(function (docs) {
            return $timeout(function () {
              yngutils.forEach(docs, function (doc) {
                delete(doc._rev);
                common.yng.push(doc);
              });
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
          common.yng.setPriorityIfNeeded(doc);
          return common.db.save(doc).then(function (createdDoc) {
            doc.$id = createdDoc.$id;
            common.yng.push(doc);
            return doc;
          });
        };

        this.update = function (doc) {
          var oldDoc = common.yng.get(doc.$id);
          return common.db.saveChanges(oldDoc, doc).then(function (changes) {
            var newDoc = common.db.merge(oldDoc, changes);
            common.yng.set(newDoc);
            return doc;
          });
        };

        this.remove = function (docOrId) {
          return common.db.delete(docOrId).then(function (deletedDoc) {
            return common.yng.remove(deletedDoc.$id);
          });
        };

        this.setPriority = function (docOrId, priority) {
          var id = common.yng.toId(docOrId), doc = common.yng.get(id);
          var newDoc = yngutils.clone(doc);
          newDoc.$priority = priority;
          return common.db.saveChanges(doc, newDoc).then(function (/* changes */) {
            // Need to trigger yng-move event as pouchdb doesn't support separate move event and
            // otherwise we cannot determine if the update event was for a move
            common.yng.moveDoc(newDoc);
            return doc;
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
  }]);