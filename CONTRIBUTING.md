Contributing
=====

Setup
----

    npm install
    bower install

Building
---

    npm run build

Tests
---

    npm run test

Tests & Coverage
---

    npm run coverage

Serve Test Coverage:
---

    npm run dev

then visit [http://127.0.0.1:8001/coverage/lcov-report](http://127.0.0.1:8001/coverage/lcov-report)

Run tests in a browser:
---

    npm run dev

then visit [http://127.0.0.1:8001/test](http://127.0.0.1:8001/test)

Run automated tests in a browser:
---

    npm run test-firefox

or

    npm run test-phantomjs

Publishing to both npm and bower
---

    tin -v VERSION
    npm run build
    git add -A
    git commit -m 'VERSION'
    git tag vVERSION
    git push origin master --tags
    npm publish

or, you can use: [tin-npm](https://gist.github.com/redgeoff/73b78d3b7a6edf21644f), e.g.

    tin-npm 0.0.2

Updating gh-pages
---

    git checkout gh-pages
    git merge master
    git push

Setup for gh-pages (only do once)
---

    git checkout -b gh-pages
    git push --set-upstream origin gh-pages
    git push

Setup Travis CI (only do once)
---

[Setup Travis CI](http://docs.travis-ci.com/user/getting-started/)

    Make small change to any file, e.g. add _Testing_ to the end of [README.md](README.md)
    git add -A
    git commit -m "feat(travis): first build for travis"
    git push

Note: you must have couchdb running in Admin Party mode at http://127.0.0.1:5984

Creating a new adapter
----
TODO: Add details about create, update, delete, move and uptodate events

**1. Copy scripts/adapters/templatyng.js, scripts/adapters/templatyng-index.js**

The convention is to take the backend's name and append a *yng*. E.G. The adapter for PouchDB is called *Pouchyng* and the adapter for Firebase is called *Firyng*

**2. Copy test/adapters/templatyng.js**

**3. Add the adapter to test/adapters/index.js**

**4. Add the adapter to the *Projects* (Kitchen Sink) example**

Add your adapter to examples/projects/adapters.js

**5. Add any dependencies to package.json**

See the _devDependencies_ section

**6. Test**
```
npm run coverage
```
Note: code coverage details can be seen by running `npm run dev` and then visiting *http://127.0.0.1:8001/coverage/lcov-report*

**7. Build**
```
npm run build
```

**8. Test your adapter in the *Projects* example**
```
npm run dev
```
Go to *http://127.0.0.1:8001/examples/projects*

**9. Submit a pull request**

**10. Pat yourself on the back and grab a beer! :)**
