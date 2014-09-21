// TODO: do we need to refactor so that can access provider before it is used, i.e. we can apply a
// plugin before the provider is used? Should we just expose something like newProvider? Really,
// this should sort of be hidden from the user as then the controller needs to understand logic
// about the adapter--however, this approach might be too controlling as someone might not want to
// have to develop a new adapter just to use a pouch plugin

// TODO: Option to enable encryption that uses filter pouch

'use strict';

/* global PouchDB */

angular.module('factoryng')
  .factory('PouchyngCommon', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
        var that = this;
        this.yng = new Yng(name, url, sortBy);
        this.db = null;
        this.to = null;
        this.from = null;
        this.changes = null;

        this.provider = function() {
          return that.db;
        };

// function createRemoteDb() {
//   var remoteDbName = that.yng.url + '/' + that.yng.name;

// // PouchDb.once('created', function (dbName) {
// //   if (dbName === remoteDbName) {
// //     de
// //   }
// // });

//   return yngutils.doAndOnce(function () {
//     var remoteDb = new PouchDB(dbName);
//   }, 'created', PouchDB).then
// }

// function createRemoteDb() {
// console.log('creating remote db');
//   var remoteDbName = that.yng.url + '/' + that.yng.name;
// console.log(remoteDbName);
//   var defer = $q.defer();

//   PouchDB.on('created', function (dbName) {
// console.log('created '+ dbName);
//     TODO: use name generated with nextId
//     if (dbName.indexOf(that.yng.name) === 0) {
// console.log('posting');
// remoteDb.post({ foo: 'bar' }).then(function () {
// console.log('fooed ok');
//   defer.resolve();
// }).catch(function (err) {
// console.log('fooed err =' + err);
// })
// //      defer.resolve();
//     }
//   });

//   var remoteDb = new PouchDB(remoteDbName);
//   return $q.all(remoteDb, defer.promise).catch(function (err) {
//     if (err.status !== 405) {
//       throw err;
//     }
//   });
// }

        this.bind = function (scope) {
// DBG - START
new PouchDB(that.yng.name + '_' + that.yng.nextId());
that.yng.bindModel(scope);
// DBG - END


          if (that.db) { // already bound
            return that.yng.rebindModel(scope);
          } else {
            // use a unique id as the name to prevent duplicate db names across adapters
            that.db = new PouchDB(that.yng.name + '_' + that.yng.nextId());

            // For some reason, pouch appears to require more event listeners than the default 11.
            // Pouch appears to register several 'destroyed' handlers. Is this really necessary?
            that.db.setMaxListeners(20);

            that.yng.scope = scope;
            that.db.on('error', that.yng.error);

// // When not using CORS it appears pouch requires an explict call to create the remote
// // database
// return createRemoteDb().then(function () {
//   sync();
// });
return sync();
          }
        };

        function syncError(err) {
// 405, 'Method Not Allowed' generated when DB first created and not really an error
/* istanbul ignore next */
//console.log('syncError=' + err);
//          if (err && err.status !== 405) {

// Appears we need to ignore error events with null parameters
if (err) {
            that.yng.error(err);
}
        }

        function onUpToDate() {
          that.yng.emit('uptodate');
        }

        function onLoadFactory(defer) {
          return function () {
            return that.map().then(function () {
              that.yng.sortIfNeeded();
              return that.yng.bindModel(that.yng.scope).then(defer.resolve);
            });
          };
        }

        function sync() {
          return that.db.info().then(function (info) {
            var defer = $q.defer();
            /* jshint camelcase: false */
            that.changes = that.db.changes({
              since: info.update_seq,
              live: true
            });
            that.registerListeners();
            var opts = { live: true }, remoteCouch = that.yng.url + '/' + that.yng.name;
            that.to = that.db.replicate.to(remoteCouch, opts, syncError);
            that.from = that.db.replicate.from(remoteCouch, opts, syncError)
                               .once('uptodate', onLoadFactory(defer))
                               .on('uptodate', onUpToDate)
                               .once('error', onLoadFactory(defer))
                               .on('complete', onUpToDate);
            return defer.promise;
          });
        }

        this.cancel = function () {
          /* istanbul ignore next */
          if (that.changes) {
            that.changes.cancel();
          }
          /* istanbul ignore next */
          if (that.to) {
            that.to.cancel();
          }
          /* istanbul ignore next */
          if (that.from) {
            that.from.cancel();
          }
        };

        function destroyRemoteDb () {
          // Calling db.destroy() only removes the local database, we need to remove the remote
          // database separately
          var remoteDb = new PouchDB(that.yng.url + '/' + that.yng.name);
          return yngutils.doAndOnce(function () {
            return remoteDb.destroy();
          }, 'destroyed', remoteDb);
// }, 'destroyed', remoteDb).catch(function (err) {
//   // When CORS is not enabled, pouch will throw a 405 error even though it still removes
//   // the remote DB
//   if (err.status !== 405) {
//     throw err;
//   }
// });
        }

        this.destroy = function (preserveRemote) {
          that.cancel();

          var localPromise = yngutils.doAndOnce(function () {
            return that.db.destroy();
          }, 'destroyed', this.db);
          var promises = [localPromise];

          if (!preserveRemote) {
// // Calling db.destroy() only removes the local database, we need to remove the remote
// // database separately
// var remoteDb = new PouchDB(that.yng.url + '/' + that.yng.name);
// var remotePromise = yngutils.doAndOnce(function () {
//   return remoteDb.destroy();
// }, 'destroyed', remoteDb).catch(function (err) {
//   // When CORS is not enabled, pouch will throw a 405 error even though it still removes
//   // the remote DB
//   if (err.status !== 405) {
//     throw err;
//   }
// });
// promises.push(remotePromise);
            promises.push(destroyRemoteDb());
          }

          return $q.all(promises).then(function () {
            return that.yng.destroy();
          });
        };

        this.copyApi = function (obj) {
          that.yng.copyApi(obj);

          var fns = [
            'provider',
            'bind',
            'destroy'
          ];
          yngutils.copyFns(fns, that, obj);
        };

      };
  }]);