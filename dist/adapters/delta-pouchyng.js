// TODO: Option to enable encryption that uses filter pouch
// TODO: Is there a way to modify yng-adapter so that it tests the istanbul ignore areas?

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('DeltaPouchyng', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        var db = null;

        this.provider = function() {
          return db;
        };

        this.bind = function (scope) {
          if (db) { // already bound
            return yng.bindModel(scope);
          } else {
            db = new PouchDB(yng.url + '/' + yng.name);
            return sync().then(function () {
              yng.sortIfNeeded();
              return yng.bindModel(scope);
            });
          }
        };

        function map() {
          return db.all().then(function (docs) {
            for (var i in docs) {
              delete(docs[i]._rev);
              yng.push(docs[i]);
            }
          });
        }

        function syncError(/* err */) {
          // TODO: best way to handle this? Should emit error event on scope?
          // console.log('syncError=' + err);
        }

        /* istanbul ignore next */
        function error(/* err */) {
          // TODO: best way to handle this? Should emit error event on scope?
          // console.log('error=' + err);
        }

        function sync() {
          return db.info().then(function (info) {
            /* jshint camelcase: false */
            db.changes({
              since: info.update_seq,
              live: true
            });
            registerListeners();
            var promise = map(), opts = { live: true };
            var remoteCouch = yng.url + '/' + yng.name;
            db.replicate.to(remoteCouch, opts, syncError);
            db.replicate.from(remoteCouch, opts, syncError);
            return promise;
          });
        }

        function registerListeners() {
          db.on('error', error);
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
            return yng.destroy(deletedDoc.$id);
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

        this.destroy = function () {
          return db.destroy();
        };

      };
  }]);