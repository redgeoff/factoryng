'use strict';

var Templatyng = require('../../../scripts/adapters/templatyng'),
    YngAdapter = require('../yng-adapter');

var adapter = new YngAdapter('Templatyng', 'https://some-url-if-applicable');
adapter.AdapterFactory = Templatyng;
adapter.run();
