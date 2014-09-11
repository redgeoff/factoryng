'use strict';

angular.module('factoryng')
  .factory('Memyng', ['$q', '$timeout', 'Yng',
    function ($q, $timeout, Yng) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        this.bind = function (scope) {
          return yng.bindModel(scope);
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
          // underlying backend so we just go straight to calling createDoc().
          return yng.createDoc(doc);
        };

        this.update = function (doc) {  
          // Most adapters would call set() here and let the underlying backend notify us of the
          // change. The notification would then trigger a call to updateDoc(). We don't have any
          // underlying backend so we just go straight to calling updateDoc().
          return yng.updateDoc(doc);
        };

        this.remove = function (docOrId) {  
          // Most adapters would call destroy() here and let the underlying backend notify us of the
          // change. The notification would then trigger a call to removeDoc(). We don't have any
          // underlying backend so we just go straight to calling removeDoc().
          return yng.removeDoc(docOrId);
        };

        this.setPriority = function (docOrId, priority) {
          var id = yng.toId(docOrId), doc = yng.get(id);
          doc.$priority = priority;
          return yng.moveDoc(doc);
        };

        this.destroy = function () {
          this.model = [];
          this.map = {};
          return $q.when();
        };
      };
  }]);