'use strict';

(function () {
var adapter = new YngAdapter('Pouchyng', 'http://127.0.0.1:5984');
adapter.run(function(_Pouchyng_) {
  adapter.Adapter = _Pouchyng_;
});
})();
