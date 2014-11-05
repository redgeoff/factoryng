'use strict';

var Pouchyng = require('../../../scripts/adapters/pouchyng'),
    YngAdapter = require('../yng-adapter');

var adapter = new YngAdapter('Pouchyng', 'http://localhost:5984');
adapter.AdapterFactory = Pouchyng;
adapter.run();