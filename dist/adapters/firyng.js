'use strict';

/* global Firebase */

angular.module('factoryng')
  .factory('Firyng', ['$q', '$timeout', 'Yng', 'yngutils',
    function ($q, $timeout, Yng, yngutils) {
      return function (name, url, sortBy) {
        var yng = new Yng(name, url, sortBy);
        yng.copyApi(this);

        var firebase = null, ref = null;

        this.provider = function() {
          return firebase;
        };

        this.bind = function (scope) {
          if (firebase) { // already bound
            return yng.bindModel(scope);
          } else {
            var defer = $q.defer();
            firebase = new Firebase(yng.url);
            ref = firebase.child(yng.name);

            // Unfortunately, there is a little inefficiency here as we need bind to resolve the
            // full model, but if there is data then 'child_added' events will still be emitted for
            // each doc and we have to honor them as we have no way to determine whether these are
            // for the initial load or not.
            registerListeners();

            ref.once('value', function (snapshot) {
              map(snapshot);
              
              // Firebase automatically sorts in ascending order
              if (yng.sortBy && yng.sortBy !== yngutils.ASC) {
                yng.sortIfNeeded();
              }

              yng.bindModel(scope).then(function () {
                defer.resolve(scope[yng.name]);
              });
            });
            return defer.promise;
          }
        };

        function toDoc(snapshot) {
          var doc = snapshot.val();
          doc.$id = snapshot.name();
          doc.$priority = snapshot.getPriority();
          return doc;
        }

        function map(snapshot) {
          snapshot.forEach(function (childSnapshot) {
            yng.push(toDoc(childSnapshot));
          });
        }

        function registerListeners() {
          ref.on('child_added', yng.applyFactory(onChildAdded));
          ref.on('child_changed', yng.applyFactory(onChildChanged));
          ref.on('child_removed', yng.applyFactory(onChildRemoved));
          ref.on('child_moved', yng.applyFactory(onChildMoved));
        }

        function setWithPriority(ref, doc) {
          var clonedDoc = yngutils.clone(doc);
          delete(clonedDoc.$id);
          delete(clonedDoc.$priority);
          // we have to use setWithPriority or else the priority will be cleared
          ref.setWithPriority(clonedDoc, doc.$priority);
        }

        this.create = function (doc) {
          var defer = $q.defer(), newDocRef = ref.push();
          doc.$id = newDocRef.name();
          yng.setPriorityIfNeeded(doc);
          setWithPriority(newDocRef, doc);
          yng.push(doc);
          defer.resolve(doc);
          return defer.promise;
        };

        this.update = function (doc) {
          var defer = $q.defer();
          setWithPriority(ref.child(doc.$id), doc);
          yng.set(doc);
          defer.resolve(doc);
          return defer.promise;
        };

        this.remove = function (docOrId) {
          var defer = $q.defer(), id = yng.toId(docOrId);
          ref.child(id).remove();
          defer.resolve(yng.destroy(id));
          return defer.promise;
        };

        this.setPriority = function (docOrId, priority) {
          var defer = $q.defer(), id = yng.toId(docOrId);
          ref.child(id).setPriority(priority);
          yng.setProperty(id, '$priority', priority);
          defer.resolve(yng.get(id));
          return defer.promise;
        };

        function onChildAdded(snapshot) {
          yng.createDoc(toDoc(snapshot));
        }

        function onChildChanged(snapshot) {
          yng.updateDoc(toDoc(snapshot));
        }

        function onChildRemoved(snapshot) {
          yng.removeDoc(snapshot.name());
        }

        function onChildMoved(snapshot) {
          yng.moveDoc(toDoc(snapshot));
        }

        this.destroy = function () {
          var defer = $q.defer();
          ref.remove(defer.resolve);
          return defer.promise;
        };
      };
  }]);