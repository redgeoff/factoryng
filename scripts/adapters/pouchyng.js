// TODO: Option to enable encryption that uses filter pouch
// TODO: Is there a way to modify yng-adapter so that it tests the istanbul ignore areas?

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('Pouchyng', ['$q', '$timeout', 'Yng', 'yngutils',
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

        function toDoc(doc) {
          doc.$id = doc._id;
          return doc;
        }

        function map() {
          /* jshint camelcase: false */
          return db.allDocs({ include_docs: true }).then(function (doc) {
            doc.rows.forEach(function (el) {
              el.doc.$id = el.id;
              yng.push(el.doc);
            });
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
          db.info(function (err, info) {
            /* jshint camelcase: false */
            db.changes({
              since: info.update_seq,
              live: true
            });
            registerListeners();
          });
          var promise = map(), opts = { live: true };
          var remoteCouch = yng.url + '/' + yng.name;
          db.replicate.to(remoteCouch, opts, syncError);
          db.replicate.from(remoteCouch, opts, syncError);
          return promise;
        }

        function registerListeners() {
          db.on('error', error)
            .on('create', yng.applyFactory(onCreate))
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
            return yng.destroy(id);
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
          if (oldDoc) { // protect against onUpdate being called when doc doesn't exist
            if (newDoc.$priority !== oldDoc.$priority) {
              yng.moveDoc(newDoc);
            } else {
              yng.updateDoc(newDoc);
            }
          }
        }

        function onDelete(response) {
          yng.removeDoc(response.doc._id);
        }

        this.destroy = function () {
          return db.destroy();
        };
      };
  }]);