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