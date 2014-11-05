'use strict';

var Memyng = require('../../../scripts/adapters/memyng'), YngAdapter = require('../yng-adapter');

var adapter = new YngAdapter('Memyng');
adapter.AdapterFactory = Memyng;
adapter.run(null, null, true);