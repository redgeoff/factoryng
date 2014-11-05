'use strict';

angular.module('contacts', ['factoryng'])

  // PouchDB adapter
  .service('contacts', function(yngutils, Pouchyng) {
    // or e.g. http://127.0.0.1:5984
    return new Pouchyng('contacts', 'https://pouchyng.iriscouch.com', yngutils.ASC);
  });

  // // Firebase adapter
  // .service('contacts', function(yngutils, Firyng) {
  //   return new Firyng('contacts', 'https://firyng.firebaseio.com', yngutils.ASC);
  // });