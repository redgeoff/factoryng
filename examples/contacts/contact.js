'use strict';

angular.module('contact', ['ngRoute', 'ui.sortable', 'contacts'])

.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      controller:'ListCtrl',
      templateUrl:'list.html'
    })
    .when('/edit/:contactId', {
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

.controller('ListCtrl', function($scope, contacts, $timeout) {
  $scope.loaded = contacts.bound(); // don't show spinner if already bound

  contacts.bind($scope).then(function () {
    console.log('done binding');
    // console.log($scope.contacts);
    $timeout(function () {
      $scope.loaded = true; // hide loading spinner
    });
  });

  var updatePriorities = function () {
    contacts.forEach(function (contact, i) {
      contacts.setPriority(contact, i).then(function () {
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
 
.controller('CreateCtrl', function($scope, $location, $timeout, contacts) {
  $scope.loaded = contacts.bound(); // don't show spinner if already bound

  contacts.bind($scope).then(function () {
    console.log('done binding');
    // console.log($scope.contacts);
    $timeout(function () {
      $scope.loaded = true; // hide loading spinner
    });
  });

  $scope.save = function () {
    contacts.create($scope.contact).then(function(/* doc */) {
      console.log('done adding doc');
      $timeout(function () { // wrap in $timeout as promise resolves "outside" of angular
        $location.path('/');
      });
    });
  };
})
 
.controller('EditCtrl',
  function($scope, $location, $routeParams, $timeout, contacts) {
    $scope.loaded = contacts.bound(); // don't show spinner if already bound

    contacts.bind($scope).then(function () {
      console.log('done binding');
      // console.log($scope.contacts);
      $timeout(function () { // trigger UI update
        // create copy so changes can be canceled
        $scope.contact = angular.copy(contacts.get($routeParams.contactId));
        $scope.loaded = true; // hide loading spinner
      });
    });
 
    $scope.destroy = function () {
      contacts.remove($scope.contact).then(function () {
        console.log('done removing');
        $timeout(function () { // wrap in $timeout as promise resolves "outside" of angular
          $location.path('/');
        });
      });
    };
 
    $scope.save = function () {
      contacts.update($scope.contact).then(function () {
        console.log('done saving');
        $timeout(function () { // wrap in $timeout as promise resolves "outside" of angular
          $location.path('/');
        });
      });
    };
});