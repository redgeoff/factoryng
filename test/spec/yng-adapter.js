
// TODO: test in chrome and firefox???

'use strict';

/* exported YngAdapter */

function YngAdapter(name, url) {

  var that = this, oldRuns = runs;

  this.run = function (injector, after, before, ephemeral /* , solo */) {

    describe('Service: ' + name, function () {

      // jasmine.getEnv().defaultTimeoutInterval = 20000;

      function error(err) {
        expect((err.stack ? err.stack : err)).toBe(''); // TODO: better way to report this error?
      }

      // jasmine-as-promised doesn't appear to output promise exceptions so we will do it manually
      function runs(fn) {
        oldRuns(function () {
          var promise = fn();
          if (promise) {
            promise.catch(function (err) {
              error(err);
            });
          }
          return promise;
        });
      }

      // Usage: setTimeoutPromise(fn, ms), setTimeoutPromise(fn) or setTimeoutPromise(ms)
      function setTimeoutPromise(fn, ms) {
        var defer = $q.defer();
        if (!yngutils.isFunction(fn)) {
          ms = fn;
        }
        setTimeout(function () {
          if (yngutils.isFunction(fn)) {
            defer.resolve(fn());
          } else {
            defer.resolve();
          }
        }, ms);
        return defer.promise;
      }

      // load the service's module
      beforeEach(module('factoryng', function ($provide) {
        // Replace $q with Q as $q requires manual manipulation of the digest and other pieces in
        // karma
        $provide.value('$q', Q);

        // Mock $timeout so that it doesn't require a $timeout.flush()
        $provide.value('$timeout', setTimeoutPromise);

        that.model = 'test_factoryng';
      }));

      var $rootScope, $q, $timeout, $scope, yngutils;
      beforeEach(inject(function (_$rootScope_, _$q_, _$timeout_, _yngutils_) {
        $rootScope = _$rootScope_;
        $q = _$q_;
        $scope = $rootScope.$new();
        $timeout = _$timeout_;
        yngutils = _yngutils_;
      }));

      var destroyed = false;

      afterEach(function () {
        runs(function () {
          if (!destroyed && that.adapter) { // don't destroy if already destroyed
            return that.adapter.destroy().then(function () {
              that.adapter = null;
            });
          } else {
            that.adapter = null;
          }
        });
      });

      // instantiate service
      beforeEach(inject(injector));

      if (before) {
        beforeEach(function () {
          runs(function () {
            return before();
          });
        });
      }

      if (after) {
        afterEach(function () {
          runs(function () {
            return after();
          });
        });
      }

      // Binds to event, executes action, after action finished resolves when event emitted
      // -->resolves({ action: actionArgs, event: eventArgs })
      function doAndOn(actionFactory, event) {
        var actionDefer = $q.defer(), eventDefer = $q.defer();
        that.adapter.once(event, function () {
          var eventArgs = arguments;
          return actionDefer.promise.then(function (actionArgs) {
            eventDefer.resolve({ action: actionArgs, event: eventArgs });
          });
        });
        return actionFactory().then(function () {
          actionDefer.resolve(arguments);
          return eventDefer.promise;
        });
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

      function setup(sortBy) {
        var promise = null;
        if (that.adapter) {
          promise = that.adapter.destroy(true); // prevent memory leak
        } else {
          promise = $q.when();
        }
        that.adapter = new that.Adapter(that.model, url, sortBy);
        that.adapter.on('error', error);
        return promise.then(function () {
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

      it('should bind', function () {
        runs(function () {
console.log('should bind1');
          return setup(yngutils.ASC).then(function () {
console.log('should bind2');
            return that.adapter.create(google).then(function () {
console.log('should bind3');
              return that.adapter.create(amazon).then(function () {
console.log('should bind4');
                $scope[that.model] = [];
                return that.adapter.bind($scope).then(function () {
console.log('should bind5');
                  expectScopeToEqual([google, amazon]);                  
                });
              });
            });
          });
        });
      });

      function loadExistingRecords(sortBy) {
        runs(function () {
          return setup().then(function () {
            return doAndOn(createFactory(google), 'uptodate').then(function () {
              return doAndOn(createFactory(amazon), 'uptodate').then(function () {
                $scope[that.model].length = 0; // clear model data
                expect(that.adapter.at(0)).not.toBeDefined();
                return setup(sortBy).then(function () {
                  expectScopeToContain(
                    sortBy === yngutils.ASC ? [google, amazon] : [amazon, google]);
                });
              });
            });
          });
        });  
      }

      // When possible, test that bind loads any existing records
      if (!ephemeral) {
        it('should load existing records', function () {
          loadExistingRecords(yngutils.ASC);
        });

        it('should load existing records in descending order', function () {
          loadExistingRecords(yngutils.DESC);
        });
      }

      it('should bind once', function () {
        // Use events to detect any change after second bind
        runs(function () {
          var foo = {
            onChange: function () {
              console.log('onChange');
            }
          };
          spyOn(foo, 'onChange');
          return setup().then(function () {
            return that.adapter.bind($scope).then(function () {
              that.adapter.on('create', foo.onChange);
              that.adapter.on('update', foo.onChange);
              that.adapter.on('remove', foo.onChange);
              that.adapter.on('move', foo.onChange);
              return setTimeoutPromise(3000).then(function () {
                expect(foo.onChange).not.toHaveBeenCalled();
              });
            });
          });
        });
      });

      function create(event, checkEvent) {
        runs(function () {
          return setup().then(function () {
            var clonedGoogle = yngutils.clone(google), clonedAmazon = yngutils.clone(amazon);
            return doAndOn(createFactory(google), event).then(function (args) {
              if (event !== 'uptodate') {
                var googleCreated = checkEvent ? args.event[0] : args.action[0];
                expectScopeToEqual([googleCreated]);
                clonedGoogle.$priority = 0;
                expectToContain(googleCreated, clonedGoogle);
              }
              return doAndOn(createFactory(amazon), event).then(function (args) {
                if (event !== 'uptodate') {
                  var amazonCreated = checkEvent ? args.event[0] : args.action[0];
                  expectScopeToEqual([googleCreated, amazonCreated]);
                  clonedAmazon.$priority = 1;
                  expectToContain(amazonCreated, clonedAmazon);
                }
              });
            });
          });
        });
      }

      it('should create and resolve with created doc', function () {
        create('create');
      });

      it('should create and create event should resolve with created doc', function () {
        create('create', true);
      });

      it('should create and uptodate event should be emitted', function () {
        create('uptodate', true);
      });

      function update(event, checkEvent) {
        runs(function () {
          return setup().then(function () {
            var clonedGoogle = yngutils.clone(google);
            return doAndOn(createFactory(google), 'create').then(function (args) {
              var clonedDoc = yngutils.clone(args.event[0]);
              clonedDoc.url = 'https://google.com';
              return doAndOn(updateFactory(clonedDoc), event).then(function (args) {
                if (event !== 'uptodate') {
                  var updatedDoc = checkEvent ? args.event[0] : args.action[0];
                  expectScopeToEqual([updatedDoc]);
                  clonedGoogle.url = 'https://google.com';
                  expectToContain(updatedDoc, clonedGoogle);
                }
              });
            });
          });
        });
      }

      it('should update and resolve with updated doc', function () {
        update('update');
      });

      it('should update and update event should resolve with updated doc', function () {
        update('update', true);
      });

      it('should update and uptodate event should be emitted', function () {
        update('uptodate', true);
      });

      it('should update even when no changes', function () {
        runs(function () {
          return setup().then(function () {
            // We don't exepect a update to be emitted, but it may be emitted
            return that.adapter.create(google).then(function () {
              return that.adapter.update(google);
            });
          });
        });
      });

      function remove(useId, event, checkEvent) {
        runs(function () {
          return setup().then(function () {
            var clonedGoogle = yngutils.clone(google);
            return doAndOn(createFactory(google), 'create').then(function (args) {
              var docCreated = args.action[0];
              return doAndOn(removeFactory(useId ? docCreated.$id : docCreated), event)
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
        });
      }

      it('should remove with doc and resolve with removed doc', function () {
        remove(null, 'remove');
      });

      // TODO: cannot test that events resolve with removed doc without having 2 clients as with 1
      // client, the doc can be removed before the event is emitted

      it('should remove and remove event should be emitted', function () {
        remove(null, 'remove', true);
      });

      it('should remove and uptodate event should be emitted', function () {
        remove(null, 'uptodate', true);
      });

      it('should remove with id and resolve with removed doc', function () {
        remove(true, 'remove');
      });

      it('remove should throw error', function () {
        runs(function () {
          return setup().then(function () {
            expect(function () {
              that.adapter.remove({ foo: 'boo' });
            }).toThrow();
          });
        });
      });

      function setPriority(useId, event, checkEvent) {
        runs(function () {
          return setup().then(function () {
            var clonedGoogle = yngutils.clone(google);
            return doAndOn(createFactory(google), 'create').then(function (args) {
              var docCreated = args.action[0];
              return doAndOn(setPriorityFactory(useId ? docCreated.$id : docCreated, 3), event)
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
        });
      }

      it('should setPriority with doc and resolve with updated doc', function () {
        setPriority(null, 'move');
      });

      it('should setPriority and move event should resolve with updated doc', function () {
        setPriority(null, 'move', true);
      });

      it('should setPriority and uptodate event should be emitted', function () {
        setPriority(null, 'uptodate', true);
      });

      it('should setPriority with id and resolve with updated doc', function () {
        setPriority(true, 'move');
      });

      it('setPriority should throw error', function () {
        runs(function () {
          return setup().then(function () {
            expect(function () {
              that.adapter.setPriority({ foo: 'boo' }, 3);
            }).toThrow();
          });
        });
      });

      it('should cleanup', function () {
        runs(function () {
          return setup().then(function () {
            return that.adapter.cleanup();
          });
        });
      });

      it('should destory', function () {
        runs(function () {
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
      });

      it('should get provider', function () {
        runs(function () {
          return setup().then(function () {
            that.adapter.provider();
          });
        });
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
      //       return setTimeoutPromise(5000);
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
}