'use strict';

angular.module('adapters', ['factoryng', 'oc.lazyLoad'])

  .factory('adapter', function(yngutils, $rootScope, $injector, $q, $ocLazyLoad) {
    var adapters = {};    
    return function(scope) {
      var a = $rootScope.adapter;
      if (!adapters[a.name]) {
        return $ocLazyLoad.load({ // dynamically load the js files
          name: 'factoryng',
          files: a.files
        }).then(function () {
          var Adapter = $injector.get(a.name); // dynamically inject the adapter
          adapters[a.name] = new Adapter('projects', a.url, yngutils.ASC);
          return adapters[a.name].bind(scope).then(function () {
            // Most production environments would not call cleanup() here and would instead call it
            // via a background process like a cron job. We will call cleanup() here as we don't
            // want to rely on an external cron job to cleanup our database when using adapters like
            // DeltaPouchyng.
            adapters[a.name].cleanup();
            return adapters[a.name];
          });
        });
      } else {
        scope.loaded = true; // don't show spinner if already bound
        return adapters[a.name].bind(scope).then(function () {
          return adapters[a.name];
        });
      }
    };
  });