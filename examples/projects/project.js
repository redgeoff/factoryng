// TODO: pouch bug report for conflict when create with delta pouch
// TODO: loading widget that shows when first create adapter and then hides after bind completes

'use strict';

angular.module('project', ['ngRoute', 'ui.sortable', 'adapters'])

.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      controller:'ListCtrl',
      templateUrl:'list.html'
    })
    .when('/edit/:projectId', {
      controller:'EditCtrl',
      templateUrl:'detail.html'
    })
    .when('/new', {
      controller:'CreateCtrl',
      templateUrl:'detail.html'
    })
    .otherwise({
      redirectTo:'/'
    });
})

.run(function ($rootScope, $route, adapters) {
  $rootScope.adapters = adapters;

  $rootScope.adapter = adapters[0];

  $rootScope.onChange = function () {
    $route.reload();
  };
})

.controller('ListCtrl', function($scope, adapter) {
  var projects = null;

  adapter($scope).then(function (projs) {
    projects = projs;
  });

  var updatePriorities = function () {
    projects.forEach(function (project, i) {
      projects.setPriority(project, i).then(function () {
        // console.log('done setting priority');
      });
    });
  };

  $scope.sortableOptions = {
    stop: function() {
      updatePriorities();
    },
    axis: 'y'
  };
})
 
.controller('CreateCtrl', function($scope, $location, $timeout, adapter) {
  var projects = null;

  adapter($scope).then(function (projs) {
    projects = projs;
  });

  $scope.save = function () {
    projects.create($scope.project).then(function(/* doc */) {
      console.log('done adding doc');
      $location.path('/');
    });
  };
})
 
.controller('EditCtrl',
  function($scope, $location, $routeParams, adapter, $timeout) {
    var projects = null;

    adapter($scope).then(function (projs) {
      projects = projs;
      $timeout(function () { // trigger UI update
        // create copy so changes can be canceled
        $scope.project = angular.copy(projects.get($routeParams.projectId));
      });
    });
 
    $scope.destroy = function () {
      projects.remove($scope.project).then(function () {
        console.log('done removing');
        $location.path('/');
      });
    };
 
    $scope.save = function () {
      projects.update($scope.project).then(function () {
        console.log('done saving');
        $location.path('/');
      });
    };
});