// TODO: Option to enable encryption that uses filter pouch

'use strict';

var YngUtils = require('../yng-utils'), PouchyngCommonFactory = require('./pouchyng-common'),
    DeltaPouch = require('delta-pouch');

module.exports = function ($q, $timeout) {
  var PouchyngCommon = new PouchyngCommonFactory($q, $timeout), yngutils = new YngUtils($q);

  // TODO: why can't we just do var PouchDB = require('pouchdb')
  // Need to require here in case pouch lazy loaded
  /* istanbul ignore next */
  if (typeof window === 'undefined' || !window.PouchDB) {
    var PouchDB = require('pouchdb');
  } else {
    var PouchDB = window.PouchDB;
  }

  PouchDB.plugin(DeltaPouch);

  return function (name, url, sortBy) {

    var common = new PouchyngCommon(name, url, sortBy, 'deltapouchyng');
    common.copyApi(this);

    common.map = function () {
      return common.db.all().then(function (docs) {
        yngutils.forEach(docs, function (doc) {
          delete(doc._rev);
          common.yng.push(doc);
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
      return $timeout(function () {
        common.yng.setPriorityIfNeeded(doc);
        return common.db.save(doc).then(function (createdDoc) {
          doc.$id = createdDoc.$id;
          common.yng.push(doc);
          return doc;
        });
      });
    };

    this.update = function (doc) {
      return $timeout(function () {
        var oldDoc = common.yng.get(doc.$id);
        return common.db.saveChanges(oldDoc, doc).then(function (changes) {
          var newDoc = common.db.merge(oldDoc, changes);
          common.yng.set(newDoc);
          return doc;
        });
      });
    };

    this.remove = function (docOrId) {
      return $timeout(function () {
        return common.db.delete(docOrId).then(function (deletedDoc) {
          return common.yng.remove(deletedDoc.$id);
        });
      });
    };

    this.setPriority = function (docOrId, priority) {
      return $timeout(function () {
        var id = common.yng.toId(docOrId), doc = common.yng.get(id);
        var newDoc = yngutils.clone(doc);
        newDoc.$priority = priority;
        return common.db.saveChanges(doc, newDoc).then(function (/* changes */) {
          // Need to trigger move event as pouchdb doesn't support separate move event and
          // otherwise we cannot determine if the update event was for a move
          common.yng.moveDoc(newDoc);
          return doc;
        });
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
};