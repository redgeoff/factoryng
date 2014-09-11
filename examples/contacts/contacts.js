'use strict';

angular.module('contacts', ['factoryng'])

  // PouchDB adapter
  .service('contacts', function(yngutils, Pouchyng) {
    return new Pouchyng('contacts', 'https://pouchyng.iriscouch.com', yngutils.ASC);
  });

  // // Firebase adapter
  // .service('contacts', function(yngutils, Firyng) {
  //   return new Firyng('contacts', 'https://firyng.firebaseio.com', yngutils.ASC);
  // });