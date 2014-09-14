'use strict';

(function () {
var adapter = new YngAdapter('Pouchyng', 'http://localhost:5984');
adapter.run(function(_Pouchyng_) {
  adapter.Adapter = _Pouchyng_;
}, null, null, false, true);
})();