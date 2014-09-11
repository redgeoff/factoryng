// TODO: use min versions after project stable

'use strict';

angular.module('adapters')

  .service('adapters', function() {
    return [
      {
        name: 'Pouchyng',
        url: 'https://pouchyng.iriscouch.com', // or e.g. http://127.0.0.1:5984
        files: [
          '//cdn.jsdelivr.net/pouchdb/3.0.5/pouchdb.js',
          '../../dist/adapters/pouchyng.js']
      }, {
        name: 'DeltaPouchyng',
        url: 'https://delta-pouch.iriscouch.com', // or e.g. http://127.0.0.1:5984
        files: [
          '//cdn.jsdelivr.net/pouchdb/3.0.5/pouchdb.js',
          '//redgeoff.github.io/delta-pouch/dist/pouchdb.delta-pouch.js',
          '../../dist/adapters/delta-pouchyng.js']
      }, {
        name: 'Firyng',
        url: 'https://firyng.firebaseio.com',
        files: [
          '//cdn.firebase.com/js/client/1.0.21/firebase.js',
          '../../dist/adapters/firyng.js']
      }, {
        name: 'Memyng',
        files: ['../../dist/adapters/memyng.js']
      }
      // Add new adapter here
    ];
  });