// TODO: test in chrome and firefox???

'use strict';

/* exported YngAdapter */

function YngAdapter(name, url) {

  var that = this;

  this.run = function (injector, after, before, ephemeral /* , solo */) {

    describe('Service: ' + name, function () {

      jasmine.getEnv().defaultTimeoutInterval = 10000;

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

        // NOTE: some adapters require the model to begin with a letter
        that.model = 'test_' + (new Date()).getTime() + '_' + Math.floor(Math.random()*1000000000);
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
          if (!destroyed && that.adapter) { // don't detroy if already destroyed
            return that.adapter.destroy();
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

      function setup(sortBy) {
        that.adapter = new that.Adapter(that.model, url, sortBy);
        return that.adapter.bind($scope);
      }

      var google = null, amazon = null;
      beforeEach(function () {
        // Some adapters modify parameters, so start w/ a fresh copy each test
        google = { name: 'google', url: 'http://google.com' };
        amazon = { name: 'amazon', url: 'http://amazon.com' };
        destroyed = false;
      });

      // // Only compare specified attributes
      // function expectScopeToContain(docs) {
      //   expect($scope[that.model].length).toEqual(docs.length);
      //   for (var i in docs) {
      //     var item = {};
      //     for (var j in docs[i]) {
      //       item[j] = $scope[that.model][i][j];
      //     }
      //     expect(item).toEqual(docs[i]);
      //   }
      // }

      function expectScopeToEqual(obj) {
        expect($scope[that.model].length).toEqual(obj.length);
        for (var i in obj) {
          expect($scope[that.model][i]).toEqual(obj[i]);
        }
      }

      it('should bind', function () {
        runs(function () {
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
      });

      // When possible, test that bind loads any existing records
      if (!ephemeral) {
        it('should load existing records', function () {
          runs(function () {
            return setup().then(function () {
              return that.adapter.create(google).then(function () {
                return that.adapter.create(amazon).then(function () {
                  $scope[that.model].length = 0; // clear model data
                  expect(that.adapter.at(0)).not.toBeDefined();
                  return setup(yngutils.ASC).then(function () {
                    expectScopeToEqual([google, amazon]);                
                  });
                });
              });
            });
          });
        });

        it('should load existing records in descending order', function () {
          runs(function () {
            return setup().then(function () {
              return that.adapter.create(google).then(function () {
                return that.adapter.create(amazon).then(function () {
                  $scope[that.model].length = 0; // clear model data
                  expect(that.adapter.at(0)).not.toBeDefined();
                  return setup(yngutils.DESC).then(function () {
                    expectScopeToEqual([amazon, google]);                
                  });
                });
              });
            });
          });
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
              $scope.$on('yng-create', foo.onChange);
              $scope.$on('yng-update', foo.onChange);
              $scope.$on('yng-remove', foo.onChange);
              $scope.$on('yng-move', foo.onChange);
              return setTimeoutPromise(3000).then(function () {
                expect(foo.onChange).not.toHaveBeenCalled();
              });
            });
          });
        });
      });

      // TODO: use promise to ensure that create of amazon finishes before checking scope for amazon
      // -- or just compare w/ clones!!
      it('should create', function () {
        runs(function () {
          var defer = $q.defer(), first = true;
          setup().then(function () {
            $scope.$on('yng-create', function (event, doc) {
              if (first) {
                expect(doc.$priority).toEqual(0);
                first = false;
              } else {
                expect(doc.$priority).toEqual(1);
                expectScopeToEqual([google, amazon]);
                defer.resolve();
              }
            });
            that.adapter.create(google).then(function () {
              that.adapter.create(amazon);
            });
          });
          return defer.promise;
        });
      });

      it('should update', function () {
        runs(function () {
          var defer = $q.defer();
          setup().then(function () {
            $scope.$on('yng-update', function (event, doc) {
              expectScopeToEqual([doc]);
              defer.resolve();
            });
            that.adapter.create(google).then(function (doc) {
              var clonedDoc = yngutils.clone(doc);
              clonedDoc.url = 'https://google.com';
              that.adapter.update(clonedDoc);
            });
          });
          return defer.promise;
        });
      });

      it('should update even when no changes', function () {
        runs(function () {
          return setup().then(function () {
            // We don't exepect a yng-update to be fired, but it may be fired
            return that.adapter.create(google).then(function () {
              return that.adapter.update(google);
            });
          });
        });
      });

      function remove(useId) {
        runs(function () {
          var defer = $q.defer();
          var rem = setup().then(function () {
            return that.adapter.create(google).then(function (docCreated) {
              $scope.$on('yng-remove', function (/* event, docRemoved */) {
                // docRemoved may be empty as the doc may have already been deleted
                expectScopeToEqual([]);
                defer.resolve();
              });
              return that.adapter.remove(useId ? docCreated.$id : docCreated).then(
                function (docRemoved) {
                  expect(docRemoved.$id).toEqual(docCreated.$id);
                });
            });
          });
          return $q.all(defer.promise, rem);
        });
      }

      it('should remove with doc', function () {
        remove();
      });

      it('should remove with id', function () {
        remove(true);
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

      function setPriority(useId) {
        runs(function () {
          var defer = $q.defer();
          setup().then(function () {
            $scope.$on('yng-create', function (event, docCreated) {
              $scope.$on('yng-move', function (event, docMoved) {
                expect(that.adapter.at(0).$priority).toEqual(3);
                expect(docMoved.$priority).toEqual(3);
                defer.resolve();
              });
              that.adapter.setPriority(useId ? docCreated.$id : docCreated, 3);
            });
            that.adapter.create(google);
          });
          return defer.promise;
        });
      }

      it('should setPriority with doc', function () {
        setPriority();
      });

      it('should setPriority with id', function () {
        setPriority(true);
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
                  expectScopeToEqual();
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
      //           $scope.$on('yng-create', function (event, doc) {
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
      //           $scope.$on('yng-update', function (event, doc) {
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
      //           $scope.$on('yng-move', function (event, doc) {
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