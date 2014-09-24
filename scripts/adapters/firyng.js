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

        this.bound = function () {
          return firebase ? true : false;
        };

        function onLoadFactory(defer) {
          return function (snapshot) {
            map(snapshot);

            // Firebase automatically sorts in ascending order
            if (yng.sortBy && yng.sortBy !== yngutils.ASC) {
              yng.sortIfNeeded();
            }
            return yng.bindModel(yng.scope).then(defer.resolve);
          };
        }

        this.bind = function (scope) {
          if (this.bound()) { // already bound
            return yng.rebindModel(scope);
          } else {
            firebase = new Firebase(yng.url);
            ref = firebase.child(yng.name);

            // Unfortunately, there is a little inefficiency here as we need bind to resolve the
            // full model, but if there is data then 'child_added' events will still be emitted for
            // each doc and we have to honor them as we have no way to determine whether these are
            // for the initial load or not.
            registerListeners();

            var defer = $q.defer();
            yng.scope = scope;
            ref.once('value', onLoadFactory(defer));
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
          ref.on('child_added', onChildAdded);
          ref.on('child_changed', onChildChanged);
          ref.on('child_removed', onChildRemoved);
          ref.on('child_moved', onChildMoved);
        }

        function setWithPriority(ref, doc) {
          var clonedDoc = yngutils.clone(doc);
          delete(clonedDoc.$id);
          delete(clonedDoc.$priority);
          // we have to use setWithPriority or else the priority will be cleared
          ref.setWithPriority(clonedDoc, doc.$priority);
        }

        this.create = function (doc) {
          return $timeout(function () {
            var newDocRef = ref.push();
            doc.$id = newDocRef.name();
            yng.setPriorityIfNeeded(doc);
            setWithPriority(newDocRef, doc);
            yng.push(doc);
            return doc;
          });
        };

        this.update = function (doc) {
          return $timeout(function () {
            setWithPriority(ref.child(doc.$id), doc);
            yng.set(doc);
            return doc;
          });
        };

        this.remove = function (docOrId) {
          return $timeout(function () {
            var id = yng.toId(docOrId);
            ref.child(id).remove();
            var doc = yng.remove(id);
            return doc;
          });
        };

        this.setPriority = function (docOrId, priority) {
          return $timeout(function () {
            var id = yng.toId(docOrId);
            ref.child(id).setPriority(priority);
            yng.setProperty(id, '$priority', priority);
            var doc = yng.get(id);
            return doc;
          });
        };

        function onChildAdded(snapshot) {
          yng.createDoc(toDoc(snapshot)).then(function () {
            yng.emit('uptodate');
          });
        }

        function onChildChanged(snapshot) {
          yng.updateDoc(toDoc(snapshot)).then(function () {
            yng.emit('uptodate');
          });
        }

        function onChildRemoved(snapshot) {
          yng.removeDoc(snapshot.name()).then(function () {
            yng.emit('uptodate');
          });
        }

        function onChildMoved(snapshot) {
          yng.moveDoc(toDoc(snapshot)).then(function () {
            yng.emit('uptodate');
          });
        }

        this.destroy = function (preserveStore) {
          if (preserveStore) {
            return yng.destroy();
          } else {
            var defer = $q.defer();
            ref.remove(function () {
              yng.destroy().then(defer.resolve);
            });
            return defer.promise;
          }
        };
      };
  }]);