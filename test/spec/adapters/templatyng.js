'use strict';

(function () {
var adapter = new YngAdapter('Templatyng', 'https://some-url-if-applicable');
adapter.run(function(_Templatyng_) {
  adapter.Adapter = _Templatyng_;
});
})();
