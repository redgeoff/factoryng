Contributing
=====

Building
----

    npm install
    bower install
    grunt

Creating a new adapter
----
**1. Copy scripts/adapters/templatyng.js**

The convention is to take the backend's name and append a *yng*. E.G. The adapter for PouchDB is called *Pouchyng* and the adapter for Firebase is called *Firyng*

**2. Copy test/adapters/templatyng.js**

**3. Add the adapter to the *Projects* (Kitchen Sink) example**

Add your adapter to examples/projects/adapters.js

**4. Add any dependencies to bower.json**

**5. Test**
```
grunt test
```
Note: code coverage details can be seen by running `grunt serve` and then visiting *http://localhost:9000/coverage*

**6. Build**
```
grunt
```

**7. Test your adapter in the *Projects* example**
```
grunt serve
```
Go to *http://localhost:9000/examples/projects*

**8. Submit a pull request**

**9. Pat yourself on the back! :)**