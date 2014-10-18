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
              remoteCouch = that.yng.url + '/' + that.yng.name;
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
  .factory('Pouchyng', ['$q', '$timeout', 'Yng', 'yngutils', 'PouchyngCommon',
    function ($q, $timeout, Yng, yngutils, PouchyngCommon) {
      return function (name, url, sortBy) {
        var common = new PouchyngCommon(name, url, sortBy);
        common.copyApi(this);

        function toDoc(doc) {
          doc.$id = doc._id;
          return doc;
        }

        common.map = function () {
          /* jshint camelcase: false */
          return common.db.allDocs({ include_docs: true }).then(function (doc) {
            doc.rows.forEach(function (el) {
              el.doc.$id = el.id;
              common.yng.push(el.doc);
            });
          });
        };

        common.registerListeners = function () {
          var onDel = onDelete; // needed or else jshint reports onDelete not used
          common.db.on('create', onCreate)
                   .on('update', onUpdate)
                   .on('delete', onDel);
        };

        this.create = function (doc) {
          return $timeout(function () {
            common.yng.setPriorityIfNeeded(doc);
            return common.db.post(doc).then(function (createdDoc) {
              doc.$id = createdDoc.id;
              doc._id = createdDoc.id;
              doc._rev = createdDoc.rev;
              common.yng.push(doc);
              return doc;
            });
          });
        };

        this.update = function (doc) {
          return $timeout(function () {
            doc._id = doc.$id;
            var clonedDoc = yngutils.clone(doc);
            delete(clonedDoc.$id);
            return common.db.put(clonedDoc).then(function (updatedDoc) {
              doc._rev = updatedDoc.rev;
              common.yng.set(doc);
              return doc;
            });
          });
        };

        this.remove = function (docOrId) {
          return $timeout(function () {
            var id = common.yng.toId(docOrId), doc = common.yng.get(id);
            return common.db.remove(doc).then(function() {
              return common.yng.remove(id);
            });
          });
        };

        this.setPriority = function (docOrId, priority) {
          return $timeout(function () {
            var id = common.yng.toId(docOrId), doc = common.yng.get(id);
            doc.$priority = priority;
            doc._id = doc.$id;
            var clonedDoc = yngutils.clone(doc);
            delete(clonedDoc.$id);
            return common.db.put(clonedDoc).then(function (updatedDoc) {
              doc._rev = updatedDoc.rev;
              // Need to trigger move event as pouchdb doesn't support separate move event and
              // otherwise we cannot determine if the create event was for a move
              common.yng.moveDoc(doc);
              return doc;
            });
          });
        };

        function onCreate(response) {
          common.yng.createDoc(toDoc(response.doc));
        }

        function onUpdate(response) {
          var newDoc = toDoc(response.doc), oldDoc = common.yng.get(newDoc.$id);
          /* istanbul ignore next */
          if (!oldDoc) {
            // Appears we can get update events for new docs when cache is clear
            common.yng.createDoc(newDoc);
          } else if (newDoc.$priority !== oldDoc.$priority) {
            common.yng.moveDoc(newDoc);
          } else {
            common.yng.updateDoc(newDoc);
          }
        }

        function onDelete(response) {
          common.yng.removeDoc(response.doc._id);
        }

      };
  }]);