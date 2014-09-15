'use strict';

(function () {
var adapter = new YngAdapter('Pouchyng', 'http://localhost:5984');
// TODO: need to patch pouchyng and delta-pouchyng so that the bind doesn't return until there
// is data before running the non-ephemeral tests
adapter.run(function(_Pouchyng_) {
  adapter.Adapter = _Pouchyng_;
}, null, null, true, true);
})();