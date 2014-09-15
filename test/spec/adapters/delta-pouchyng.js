'use strict';

(function () {
var adapter = new YngAdapter('DeltaPouchyng', 'http://localhost:5984');
// TODO: need to patch pouchyng and delta-pouchyng so that the bind doesn't return until there
// is data before running the non-ephemeral tests
adapter.run(function(_DeltaPouchyng_) {
  adapter.Adapter = _DeltaPouchyng_;
}, null, null, true, true);
})();