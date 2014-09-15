Contributing
=====

Building
----

    npm install
    bower install
    grunt

Testing
----

    grunt test

Note: you must have couchdb running in Admin Party mode at http://127.0.0.1:5984

Creating a new adapter
----
**1. Copy scripts/adapters/templatyng.js**

The convention is to take the backend's name and append a *yng*. E.G. The adapter for PouchDB is called *Pouchyng* and the adapter for Firebase is called *Firyng*

**2. Copy test/adapters/templatyng.js**

**3. Add the adapter to the *Projects* (Kitchen Sink) example**

Add your adapter to examples/projects/adapters.js

**4. Add any dependencies to bower.json**

**5. Add any dependencies to test/karma.config.js**

See the files section

**6. Test**
```
grunt test
```
Note: code coverage details can be seen by running `grunt serve` and then visiting *http://localhost:9000/coverage*

**7. Build**
```
grunt
```

**8. Test your adapter in the *Projects* example**
```
grunt serve
```
Go to *http://localhost:9000/examples/projects*

**9. Submit a pull request**

**10. Pat yourself on the back and grab a beer! :)**


Publishing
----
Let VERSION be something like 1.0.1

    tin -v VERSION
    grunt
    git add -A
    git commit -m 'VERSION'
    git tag vVERSION
    git push origin master --tags


Updating gh-pages
----

    git checkout gh-pages
    git merge master
    git push
