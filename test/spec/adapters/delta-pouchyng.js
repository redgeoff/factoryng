'use strict';

var DeltaPouchyng = require('../../../scripts/adapters/delta-pouchyng'),
    YngAdapter = require('../yng-adapter');

var adapter = new YngAdapter('DeltaPouchyng', 'http://localhost:5984');
adapter.AdapterFactory = DeltaPouchyng;
adapter.run();