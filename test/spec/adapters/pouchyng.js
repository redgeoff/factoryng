'use strict';

(function () {
// var adapter = new YngAdapter('Pouchyng', 'https://notewall.iriscouch.com');
var adapter = new YngAdapter('Pouchyng', 'http://localhost:5984');
adapter.run(function(_Pouchyng_) {
  adapter.Adapter = _Pouchyng_;
});
})();