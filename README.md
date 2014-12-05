factoryng
====

[![Build Status](https://travis-ci.org/redgeoff/factoryng.svg)](https://travis-ci.org/redgeoff/factoryng)

An all-in-one angularjs factory that wraps multiple backends.

Why?
----
AngularJS is great and there are tons of amazing backends like pouch, firebase, etc... Unfortunately, some of your backend's structure ultimately leaks into your angular controllers. This means that your controllers are then tightly coupled with your backend, which makes it difficult to switch your backend without modifying your controllers.

With factoryng, you can feel free to develop your controllers with little regard to your backend. If you choose to switch backends, include a new backend or use multiple backends you don't have to worry about rewriting your controllers. Sure, your current backend works great for you now, but will it still be your top choice in 6 months?

Live Demo: Projects (Kitchen Sink)
----
[Projects Demo](http://redgeoff.github.io/factoryng/examples/projects)

Live Demo: Contacts (Simple Example)
----
[Contacts Demo](http://redgeoff.github.io/factoryng/examples/contacts)

And, the [Contacts Demo Source Code](https://github.com/redgeoff/factoryng/blob/master/examples/contacts/contact.js)

Usage
----
**Download via bower**
```
bower install factoryng
```

**Download via npm**
```
npm install factoryng
```

**Include the scripts**

You must include any adapters that you are using and any underlying adapter technologies, e.g.

```html
<script src="//cdn.jsdelivr.net/pouchdb/3.0.5/pouchdb.min.js"></script>
<script src="bower_components/factoryng/dist/adapters/pouchyng.min.js"></script>

<script src="//cdn.firebase.com/js/client/1.0.21/firebase.js"></script>
<script src="bower_components/factoryng/dist/adapters/firyng.min.js"></script>
```

API
----
Let *Adapter* be the adapter, e.g. Pouchyng, DeltaPouchyng, Firying, etc...

**Instantiate**
```js
var adapter = new Adapter(name[, url, sortBy]);
```
e.g.
```js
var adapter = new Adapter('todos', 'http://127.0.0.1:5984', yngutils.ASC);
```
or:
```js
var adapter = new Adapter('todos', 'http://127.0.0.1:5984', function (a, b) {
  return a.someAttr - b.someAttr;
});
```

**Bind**
```js
adapter.bind(scope);
```
e.g.
```js
// Bind to $scope and load all docs
adapter.bind($scope).then(function () {
  console.log('done binding');
  console.log($scope.todos);
  // $scope.todos[0] = adapter.at(0)
  // $scope.todos[0].$id = the unique id of the doc
  // $scope.todos[0].$priority = the priority/order of the doc
});
```

**Create Doc**
```js
adapter.create(doc);
```
e.g.
```js
adapter.create(doc).then(function(createdDoc) {
  console.log('done creating doc');
  // createdDoc.$id = the unique id of the new doc
});
```

**Update Doc**
```js
adapter.update(doc);
```
e.g.
```js
adapter.update(doc).then(function (updatedDoc) {
  console.log('done updating doc');
  // updatedDoc.$id = the unique id of the updated doc
});
```

**Prioritize/Order Doc**
```js
adapter.setPriority(docOrId, priority);
```
e.g.
```js
adapter.setPriority('123', 4).then(function (updatedDoc) {
  console.log('done setting priority');
  // updatedDoc.$id = the unique id of the updated doc
  // adapter.get('123').$priority = 4
});
```

**Remove Doc**
```js
adapter.remove(docOrId);
```
e.g.
```js
adapter.remove(docOrId).then(function (deletedDoc) {
  console.log('done removing');
  // deletedDoc.$id = the unique id of the updated doc
});
```

**For Each**
```js
adapter.forEach(callback[, thisArg]);
```
e.g.
```js
adapter.forEach(function (element, index, array) {
  console.log('a[' + index + '] = ' + element);
});
```

**At**
```js
adapter.at(index);
```
e.g.
```js
adapter.at(0); // first doc
adapter.at(1); // second doc
```

**Get**
```js
adapter.get(id);
```
e.g.
```js
adapter.get('123'); // get doc with $id = '123'
```

Contributing
----
A few adapters have already been written. Is yours missing? [Can you help us write it?](CONTRIBUTING.md)
