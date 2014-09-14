'use strict';

(function () {
var adapter = new YngAdapter('DeltaPouchyng', 'http://localhost:5984');
adapter.run(function(_DeltaPouchyng_) {
  adapter.Adapter = _DeltaPouchyng_;
}, null, null, false, true);
})();