'use strict';

(function () {
var adapter = new YngAdapter('Memyng');
adapter.run(function(_Memyng_) {
  adapter.Adapter = _Memyng_;
}, null, null, true);
})();
