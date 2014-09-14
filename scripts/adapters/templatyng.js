'use strict';

// Note: You will most likely need to add a global statement for jshint, like /* global SomeLib */

angular.module('factoryng')
  .factory('Templatyng', ['$q', '$timeout', 'Yng',
    function ($q, $timeout, Yng) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        this.bind = function (scope) {
          // load docs
          return yng.bindModel(scope);
        };

        this.create = function (doc) {
          // create doc and return promise
        };

        this.update = function (doc) {  
          // update doc and return promise
        };

        this.remove = function (docOrId) {  
          // remove doc and return promise
        };

        this.setPriority = function (docOrId, priority) {
          // set doc priority and return promise
        };

        this.destroy = function (preserveStore) {
          // destroy data store and return promise
        };
      };
  }]);