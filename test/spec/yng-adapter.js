// TODO: test to make sure that bind, create, update, delete and setPriority return promise wrapped
// in $q, i.e. schedules digest cycle

// TODO: test in chrome and firefox???

'use strict';

var expect = require('expect'), Q = require('q'), sinon = require('sinon'),
    utils = require('./utils'), YngUtils = require('../../scripts/yng-utils'),
    YngFactory = require('../../scripts/yng');

module.exports = function (name, url) {

  var that = this;

  this.run = function (after, before, ephemeral /* , solo */) {

    describe(name, function () {

      this.timeout(8000); // increase timeout for TravisCI

      function error(err) {
        // errors automatically reported
      }

      // Mock $rootScope.$new()
      var RootScope = function () {
        this.$new = function () {
          return {};
        };
      };

      var $q = Q, $timeout = utils.timeout, yngutils = new YngUtils($q), $rootScope, $scope;
      // Replace $q with Q as $q requires manual manipulation of the digest and other pieces in karma
      // Mock $timeout so that it doesn't require a $timeout.flush()
      $rootScope = new RootScope();
      that.Adapter = new that.AdapterFactory($q, $timeout);
      that.model = 'test_factoryng';
      
      beforeEach(function () {
        $scope = $rootScope.$new();
      });

      var destroyed = false;

      afterEach(function () {
        if (!destroyed && that.adapter) { // don't destroy if already destroyed
          return that.adapter.destroy().then(function () {
            that.adapter = null;
          });
        } else {
          that.adapter = null;
        }
      });

      if (before) {
        beforeEach(function () {
          return before();
        });
      }

      if (after) {
        afterEach(function () {
          return after();
        });
      }

      function doAndOnce(actionFactory, event) {
        return yngutils.doAndOnce(actionFactory, event, that.adapter);
      }

      function createFactory(doc) {
        return function () {
          return that.adapter.create(doc);
        };
      }

      function updateFactory(doc) {
        return function () {
          return that.adapter.update(doc);
        };
      }

      function removeFactory(docOrId) {
        return function () {
          return that.adapter.remove(docOrId);
        };
      }

      function setPriorityFactory(docOrId, priority) {
        return function () {
          return that.adapter.setPriority(docOrId, priority);
        };
      }

      function setup(sortBy, user) {
        var promise = null;
        if (that.adapter) {
          promise = that.adapter.destroy(true); // prevent memory leak
        } else {
          promise = $q.when();
        }
        return promise.then(function () {
          that.adapter = new that.Adapter(that.model, url, sortBy);
          if (user) {
            that.adapter.properties().user = user;
          }
          that.adapter.on('error', error);
          return that.adapter.bind($scope);
        });
      }

      var google = null, amazon = null;
      // var n = 1; // for dbg
      beforeEach(function () {
        // Some adapters modify parameters, so start w/ a fresh copy each test
        // console.log('starting test ' + (n++)); // for dbg
        google = { name: 'google', url: 'http://google.com' };
        amazon = { name: 'amazon', url: 'http://amazon.com' };
        destroyed = false;
      });

      // Only compare specified attributes
      function expectScopeToContain(docs) {
        expect($scope[that.model].length).toEqual(docs.length);
        for (var i in docs) {
          var item = {};
          for (var j in docs[i]) {
            item[j] = $scope[that.model][i][j];
          }
          expect(item).toEqual(docs[i]);
        }
      }

      function expectScopeToEqual(obj) {
        expect($scope[that.model].length).toEqual(obj ? obj.length : 0);
        if ($scope[that.model].length === obj ? obj.length : 0) {
          for (var i in obj) {
            expect($scope[that.model][i]).toEqual(obj[i]);
          }
        }
      }

      // Only compare specified attributes
      function expectToContain(actual, expected) {
        var item = {};
        for (var i in expected) {
          item[i] = actual[i];
        }
        expect(item).toEqual(expected);
      }

      // destory first in case last test failed and left data in the remote store
      it('should destory', function () {
        return setup().then(function () {
          return that.adapter.create(google).then(function () {
            return that.adapter.create(amazon).then(function () {
              return that.adapter.destroy().then(function () {
                destroyed = true;
                expect(that.adapter.length() === 0);
              });
            });
          });
        });
      });

      it('should bind', function () {
        return setup(yngutils.ASC).then(function () {
          return that.adapter.create(google).then(function () {
            return that.adapter.create(amazon).then(function () {
              $scope[that.model] = [];
              return that.adapter.bind($scope).then(function () {
                expectScopeToEqual([google, amazon]);
              });
            });
          });
        });
      });

      function loadExistingRecords(sortBy) {
        return setup().then(function () {
          return doAndOnce(createFactory(google), 'uptodate').then(function () {
            return doAndOnce(createFactory(amazon), 'uptodate').then(function () {
              $scope[that.model].length = 0; // clear model data
              // expect(that.adapter.at(0)).not.toBeDefined();
              yngutils.notDefined(that.adapter.at(0)).should.be.true;
              return setup(sortBy).then(function () {
                expectScopeToContain(
                  sortBy === yngutils.ASC ? [google, amazon] : [amazon, google]);
              });
            });
          });
        });
      }

      // When possible, test that bind loads any existing records
      if (!ephemeral) {
        it('should load existing records', function () {
          return loadExistingRecords(yngutils.ASC);
        });

        it('should load existing records in descending order', function () {
          return loadExistingRecords(yngutils.DESC);
        });
      }

      it('should bind once', function () {
        // Use events to detect any change after second bind
        var onChange = sinon.spy();
        return setup().then(function () {
          return that.adapter.bind($scope).then(function () {
            that.adapter.on('create', onChange);
            that.adapter.on('update', onChange);
            that.adapter.on('remove', onChange);
            that.adapter.on('move', onChange);
            return utils.timeout(3000).then(function () {
              onChange.called.should.equal.false;
            });
          });
        });
      });

      function create(event, checkEvent, user) {
        return setup(null, user).then(function () {
          var clonedGoogle = yngutils.clone(google), clonedAmazon = yngutils.clone(amazon);
          return doAndOnce(createFactory(google), event).then(function (args) {
            if (event !== 'uptodate') {
              var googleCreated = checkEvent ? args.event[0] : args.action[0];
              expectScopeToEqual([googleCreated]);
              clonedGoogle.$priority = 0;
              expectToContain(googleCreated, clonedGoogle);
            }
            return doAndOnce(createFactory(amazon), event).then(function (args) {
              if (event !== 'uptodate') {
                var amazonCreated = checkEvent ? args.event[0] : args.action[0];
                expectScopeToEqual([googleCreated, amazonCreated]);
                clonedAmazon.$priority = 1;
                expectToContain(amazonCreated, clonedAmazon);
              }
            });
          });
        });
      }

      it('should create and resolve with created doc', function () {
        return create('create');
      });

      it('should create and create event should resolve with created doc', function () {
        return create('create', true);
      });

      it('should create and uptodate event should be emitted', function () {
        return create('uptodate', true);
      });

      function update(event, checkEvent) {
        return setup().then(function () {
          var clonedGoogle = yngutils.clone(google);
          return doAndOnce(createFactory(google), 'create').then(function (args) {
            var clonedDoc = yngutils.clone(args.event[0]);
            clonedDoc.url = 'https://google.com';
            return doAndOnce(updateFactory(clonedDoc), event).then(function (args) {
            });
          });
        });
      }

      it('should update and resolve with updated doc', function () {
        return update('update');
      });

      it('should update and update event should resolve with updated doc', function () {
        return update('update', true);
      });

      it('should update and uptodate event should be emitted', function () {
        return update('uptodate', true);
      });

      it('should update even when no changes', function () {
        return setup().then(function () {
          // We don't exepect a update to be emitted, but it may be emitted
          return that.adapter.create(google).then(function () {
            return that.adapter.update(google);
          });
        });
      });

      function remove(useId, event, checkEvent) {
        return setup().then(function () {
          var clonedGoogle = yngutils.clone(google);
          return doAndOnce(createFactory(google), 'create').then(function (args) {
            var docCreated = args.action[0];
            return doAndOnce(removeFactory(useId ? docCreated.$id : docCreated), event)
              .then(function (args) {
                expectScopeToEqual([]);
                if (!checkEvent) {
                  // var docRemoved = checkEvent ? args.event[0] : args.action[0];
                  var docRemoved = args.action[0];
                  clonedGoogle.$id = docCreated.$id;
                  expectToContain(docRemoved, clonedGoogle);
                }
              });
          });
        });
      }

      it('should remove with doc and resolve with removed doc', function () {
        return remove(null, 'remove');
      });

      // TODO: cannot test that events resolve with removed doc without having 2 clients as with 1
      // client, the doc can be removed before the event is emitted

      it('should remove and remove event should be emitted', function () {
        return remove(null, 'remove', true);
      });

      it('should remove and uptodate event should be emitted', function () {
        return remove(null, 'uptodate', true);
      });

      it('should remove with id and resolve with removed doc', function () {
        return remove(true, 'remove');
      });

      it('remove should throw error', function () {
        return setup().then(function () {
          return that.adapter.remove({ foo: 'boo' }).then(function () {
            error('should not execute this');
          }).catch(function (/* err */) {
            // should execute this
          });
        });
      });

      function setPriority(useId, event, checkEvent) {
        return setup().then(function () {
          var clonedGoogle = yngutils.clone(google);
          return doAndOnce(createFactory(google), 'create').then(function (args) {
            var docCreated = args.action[0];
            return doAndOnce(setPriorityFactory(useId ? docCreated.$id : docCreated, 3), event)
              .then(function (args) {
                if (event !== 'uptodate') {
                  var docMoved = checkEvent ? args.event[0] : args.action[0];
                  expectScopeToEqual([docMoved]);
                  clonedGoogle.$priority = 3;
                  expectToContain(docMoved, clonedGoogle);
                }
              });
          });
        });
      }

      it('should setPriority with doc and resolve with updated doc', function () {
        return setPriority(null, 'move');
      });

      it('should setPriority and move event should resolve with updated doc', function () {
        return setPriority(null, 'move', true);
      });

      it('should setPriority and uptodate event should be emitted', function () {
        return setPriority(null, 'uptodate', true);
      });

      it('should setPriority with id and resolve with updated doc', function () {
        return setPriority(true, 'move');
      });

      it('setPriority should throw error', function () {
        return setup().then(function () {
          return that.adapter.setPriority({ foo: 'boo' }, 3).then(function () {
            error('should not execute this');
          }).catch(function (/* err */) {
            // should execute this
          });
        });
      });

      it('should cleanup', function () {
        return setup().then(function () {
          return that.adapter.cleanup();
        });
      });

      it('should get provider', function () {
        return setup().then(function () {
          that.adapter.provider();
        });
      });

      it('should work for user', function () {
        return create('create', null, 'test_user');
      });

      // // TODO: Will the following work now that we have restructured pouchyng???
      // // TODO: future project? Appears not very stable to have two instances of pouch syncing
      // // with the same database. Probably has something to do with the 2 instances being in the
      // // same JS VM instance. What if we could use multiple VM instances to simulate multiple
      // // clients.

      // // When possible, test that changes to propagate
      // if (!solo) {

      //   // For some reason, some backends like PouchDB require a delay after destroying or else
      //   // timeouts occur
      //   var destroyAndSleep = function (adapter) {
      //     return adapter.destroy().then(function () {
      //       return utils.timeout(5000);
      //     });
      //   };

      //   it('create should propagate', function () {
      //     runs(function () {
      //       return setup().then(function () {
      //         var adapter2 = new that.Adapter(that.model, url);
      //         var scope2 = $rootScope.$new();
      //         return adapter2.bind(scope2).then(function () {
      //           var defer = $q.defer(), clonedGoogle = yngutils.clone(google);
      //           that.adapter.on('create', function (doc) {
      //             expectScopeToContain([clonedGoogle]);
      //             destroyAndSleep(adapter2).then(defer.resolve);
      //             // defer.resolve();
      //           });
      //           adapter2.create(google).catch(function (err) {
      //             console.log('---CREATE ERROR = ' + err);
      //           });
      //           return defer.promise;
      //         });
      //       });
      //     });
      //   });

      //   it('update should propagate', function () {
      //     runs(function () {
      //       return setup().then(function () {
      //         var adapter2 = new that.Adapter(that.model, url);
      //         var scope2 = $rootScope.$new();
      //         var clonedGoogle = yngutils.clone(google);
      //         return adapter2.bind(scope2).then(function () {
      //           var defer = $q.defer();
      //           that.adapter.on('update', function (doc) {
      //             clonedGoogle.url = 'https://gmail.com';
      //             expectScopeToContain([clonedGoogle]);
      //             destroyAndSleep(adapter2).then(defer.resolve);
      //             // defer.resolve();
      //           });
      //           adapter2.create(google).then(function (docCreated) {
      //             adapter2.update({ $id: docCreated.$id, url: 'https://gmail.com' });
      //           }).catch(function (err) {
      //             console.log('---UPDATE ERROR = ' + err);
      //           });
      //           return defer.promise;
      //         });
      //       });
      //     });
      //   });

      //   it('setPriority should propagate', function () {
      //     runs(function () {
      //       return setup().then(function () {
      //         var adapter2 = new that.Adapter(that.model, url);
      //         var scope2 = $rootScope.$new();
      //         return adapter2.bind(scope2).then(function () {
      //           var defer = $q.defer(), clonedGoogle = yngutils.clone(google);
      //           that.adapter.on('move', function (doc) {
      //             clonedGoogle.$priority = 2;
      //             expectScopeToContain([clonedGoogle]);
      //             destroyAndSleep(adapter2).then(defer.resolve);
      //             // defer.resolve();
      //           });
      //           adapter2.create(google).then(function (docCreated) {
      //             adapter2.setPriority(docCreated, 2);
      //           }).catch(function (err) {
      //             console.log('---SET PRIORITY ERROR = ' + err);
      //           });
      //           return defer.promise;
      //         });
      //       });
      //     });
      //   });

      //   // delete should propagate

      // }

    });
  };
};