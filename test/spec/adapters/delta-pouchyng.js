'use strict';

(function () {
var adapter = new YngAdapter('DeltaPouchyng', 'http://127.0.0.1:5984');
adapter.run(function(_DeltaPouchyng_) {
  adapter.Adapter = _DeltaPouchyng_;
});
})();
