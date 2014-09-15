// TODO: Option to enable encryption that uses filter pouch
// TODO: Is there a way to modify yng-adapter so that it tests the istanbul ignore areas?
// TODO: way to share code between pouchyng and delta-pouchyng? Probably after spec stabilizes

// TODO: It appears that if the couchdb doesn't exist then the first allDocs, executed by bind,
// doesn't return any docs. How can one make bind "try again" until allDocs returns data? It doesn't
// appear that there is a reliable error to key on.

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('DeltaPouchyng', ['$q', '$timeout', 'Yng', 'yngutils',
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

        function map() {
          return db.all().then(function (docs) {
            var promises = [];

            // TODO: need to patch pouchyng and delta-pouchyng so that the bind doesn't return until
            // there is data before requiring code coverage of the following
            /* istanbul ignore next */
            for (var i in docs) {
              delete(docs[i]._rev);
              promises.push(yng.createDoc(docs[i]));
            }

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
          db.deltaInit();
          db.delta
            .on('create', yng.applyFactory(onCreate))
            .on('update', yng.applyFactory(onUpdate))
            .on('delete', yng.applyFactory(onDelete));
        }

        this.create = function (doc) {
          yng.setPriorityIfNeeded(doc);
          return db.save(doc).then(function (createdDoc) {
            doc.$id = createdDoc.$id;
            yng.push(doc);
            return doc;
          });
        };

        this.update = function (doc) {
          var oldDoc = yng.get(doc.$id);
          return db.saveChanges(oldDoc, doc).then(function (changes) {
            var newDoc = db.merge(oldDoc, changes);
            yng.set(newDoc);
            return doc;
          });
        };

        this.remove = function (docOrId) {
          return db.delete(docOrId).then(function (deletedDoc) {
            return yng.remove(deletedDoc.$id);
          });
        };

        this.setPriority = function (docOrId, priority) {
          var id = yng.toId(docOrId), doc = yng.get(id);
          var newDoc = yngutils.clone(doc);
          newDoc.$priority = priority;
          return db.saveChanges(doc, newDoc).then(function (/* changes */) {
            // Need to trigger yng-move event as pouchdb doesn't support separate move event and
            // otherwise we cannot determine if the update event was for a move
            yng.moveDoc(newDoc);
            return doc;
          });
        };

        function onCreate(doc) {
          delete(doc._rev);
          yng.createDoc(doc);
        }

        function onUpdate(changes) {
          delete(changes._rev);
          var oldDoc = yng.get(changes.$id), newDoc = db.merge(oldDoc, changes);
          /* istanbul ignore if */
          if (newDoc.$priority !== oldDoc.$priority) {
            yng.moveDoc(newDoc);
          } else {
            yng.updateDoc(newDoc);
          }
        }

        function onDelete(id) {
          yng.removeDoc(id);
        }

        this.cleanup = function () {
          return db.cleanup();
        };

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