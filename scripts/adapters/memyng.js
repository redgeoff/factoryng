'use strict';

angular.module('factoryng')
  .factory('Memyng', ['$q', '$timeout', 'Yng',
    function ($q, $timeout, Yng) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        this.bind = function (scope) {
          return yng.rebindModel(scope);
        };

        // Note: this function doesn't guarantee a unique id, just makes it very unlikely that two
        // ids will be the same
        function guid() {
          return (new Date()).getTime() + '_' + Math.random().toString(36).substr(2, 9);
        }

        this.create = function (doc) {
          yng.setPriorityIfNeeded(doc);
          doc.$id = guid();
        
          // Most adapters would call push() here and let the underlying backend notify us of the
          // change. The notification would then trigger a call to createDoc(). We don't have any
          // underlying backend so we just go straight to calling createDoc() and emitting uptodate
          return yng.createDoc(doc).then(function (createdDoc) {
            yng.emit('uptodate');
            return createdDoc;
          });
        };

        this.update = function (doc) {  
          // Most adapters would call set() here and let the underlying backend notify us of the
          // change. The notification would then trigger a call to updateDoc(). We don't have any
          // underlying backend so we just go straight to calling updateDoc() and emitting uptodate
          return yng.updateDoc(doc).then(function (updatedDoc) {
            yng.emit('uptodate');
            return updatedDoc;
          });
        };

        this.remove = function (docOrId) {  
          // Most adapters would call destroy() here and let the underlying backend notify us of the
          // change. The notification would then trigger a call to removeDoc(). We don't have any
          // underlying backend so we just go straight to calling removeDoc() and emitting uptodate
          return yng.removeDoc(docOrId).then(function (removedDoc) {
            yng.emit('uptodate');
            return removedDoc;
          });
        };

        this.setPriority = function (docOrId, priority) {
          return $timeout(function () {
            // Need to wrap in $q promise in case error thrown by yng.toId()
            var id = yng.toId(docOrId), doc = yng.get(id);
            doc.$priority = priority;
            return yng.moveDoc(doc).then(function (updatedDoc) {
              yng.emit('uptodate');
              return updatedDoc;
            });
          });
        };
      };
  }]);