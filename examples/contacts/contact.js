// TODO: pouch bug report for conflict when create with delta pouch

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

.controller('ListCtrl', function($scope, contacts) {
  contacts.bind($scope).then(function () {
    console.log('done binding');
    // console.log($scope.contacts);
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
  contacts.bind($scope).then(function () {
    console.log('done binding');
    // console.log($scope.contacts);
  });

  $scope.save = function () {
    contacts.create($scope.contact).then(function(/* doc */) {
      console.log('done adding doc');
      $location.path('/');
    });
  };
})
 
.controller('EditCtrl',
  function($scope, $location, $routeParams, $timeout, contacts) {
    contacts.bind($scope).then(function () {
      console.log('done binding');
      // console.log($scope.contacts);
      $timeout(function () { // trigger UI update
        // create copy so changes can be canceled
        $scope.contact = angular.copy(contacts.get($routeParams.contactId));
      });
    });
 
    $scope.destroy = function () {
      contacts.remove($scope.contact).then(function () {
        console.log('done removing');
        $location.path('/');
      });
    };
 
    $scope.save = function () {
      contacts.update($scope.contact).then(function () {
        console.log('done saving');
        $location.path('/');
      });
    };
});