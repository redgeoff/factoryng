// TODO: Option to enable encryption that uses filter pouch

'use strict';

var YngUtils = require('../yng-utils'), PouchyngCommonFactory = require('./pouchyng-common');

module.exports = function ($q, $timeout) {
  var PouchyngCommon = new PouchyngCommonFactory($q, $timeout), yngutils = new YngUtils($q);

  return function (name, url, sortBy) {
    var common = new PouchyngCommon(name, url, sortBy, 'pouchyng');
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
};