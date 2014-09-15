// TODO: Option to enable encryption that uses filter pouch
// TODO: Is there a way to modify yng-adapter so that it tests the istanbul ignore areas?

// TODO: It appears that if the couchdb doesn't exist then the first allDocs, executed by bind,
// doesn't return any docs. How can one make bind "try again" until allDocs returns data? It doesn't
// appear that there is a reliable error to key on.

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('Pouchyng', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        var db = null, to = null, from = null, changes = null;

        this.provider = function() {
          return db;
        };

        this.bind = function (scope) {
          if (db) { // already bound
            return yng.bindModel(scope);
          } else {
            // use a unique id as the name to prevent duplicate db names across adapters
            db = new PouchDB(yng.name + '_' + yng.nextId());
            db.on('error', error);
            return sync().then(function () {
              yng.sortIfNeeded();
              return yng.bindModel(scope);
            });
          }
        };

        function toDoc(doc) {
          doc.$id = doc._id;
          return doc;
        }

        function map() {
          /* jshint camelcase: false */
          return db.allDocs({ include_docs: true }).then(function (doc) {
            var promises = [];

            // TODO: need to patch pouchyng and delta-pouchyng so that the bind doesn't return until
            // there is data before requiring code coverage of the following
            /* istanbul ignore next */
            doc.rows.forEach(function (el) {
              el.doc.$id = el.id;
              promises.push(yng.createDoc(el.doc));
            });

            return $q.all(promises);
          });
        }

        function syncError(err) {
          // 405, 'Method Not Allowed' generated when DB first created and not really an error
          /* istanbul ignore next */
          if (err && err.status !== 405) {
            yng.error(err);
          }
        }

        /* istanbul ignore next */
        function error(err) {
          yng.error(err);
        }

        function sync() {
          return db.info().then(function (info) {
            /* jshint camelcase: false */
            changes = db.changes({
              since: info.update_seq,
              live: true
            });
            registerListeners();
            var promise = map(), opts = { live: true };
            var remoteCouch = yng.url + '/' + yng.name;
            to = db.replicate.to(remoteCouch, opts, syncError);
            from = db.replicate.from(remoteCouch, opts, syncError);
            return promise;
          });
        }

        function registerListeners() {
          db.on('create', yng.applyFactory(onCreate))
            .on('update', yng.applyFactory(onUpdate))
            .on('delete', yng.applyFactory(onDelete));
        }

        this.create = function (doc) {
          yng.setPriorityIfNeeded(doc);
          return db.post(doc).then(function (createdDoc) {
            doc.$id = createdDoc.id;
            doc._id = createdDoc.id;
            doc._rev = createdDoc.rev;
            yng.push(doc);
            return doc;
          });
        };

        this.update = function (doc) {
          doc._id = doc.$id;
          var clonedDoc = yngutils.clone(doc);
          delete(clonedDoc.$id);
          return db.put(clonedDoc).then(function (updatedDoc) {
            doc._rev = updatedDoc.rev;
            yng.set(doc);
            return doc;
          });
        };

        this.remove = function (docOrId) {
          var id = yng.toId(docOrId), doc = yng.get(id);
          return db.remove(doc).then(function() {
            return yng.remove(id);
          });
        };

        this.setPriority = function (docOrId, priority) {
          var id = yng.toId(docOrId), doc = yng.get(id);
          doc.$priority = priority;
          doc._id = doc.$id;
          var clonedDoc = yngutils.clone(doc);
          delete(clonedDoc.$id);
          return db.put(clonedDoc).then(function (updatedDoc) {
            doc._rev = updatedDoc.rev;
            // Need to trigger yng-move event as pouchdb doesn't support separate move event and
            // otherwise we cannot determine if the create event was for a move
            yng.moveDoc(doc);
            return doc;
          });
        };

        function onCreate(response) {
          yng.createDoc(toDoc(response.doc));
        }

        function onUpdate(response) {
          var newDoc = toDoc(response.doc), oldDoc = yng.get(newDoc.$id);
          /* istanbul ignore next */
          if (!oldDoc) {
            // Appears we can get update events for new docs when cache is clear
            yng.createDoc(newDoc);
          } else if (newDoc.$priority !== oldDoc.$priority) {
            yng.moveDoc(newDoc);
          } else {
            yng.updateDoc(newDoc);
          }
        }

        function onDelete(response) {
          yng.removeDoc(response.doc._id);
        }

        function cancel() {
          to.cancel();
          from.cancel();
          changes.cancel();
        }

        this.destroy = function (preserveStore) {
          cancel();
          if (preserveStore) {
            return yng.destroy();
          } else {
            return db.destroy().then(function () {
              return yng.destroy();
            });
          }
        };

      };
  }]);