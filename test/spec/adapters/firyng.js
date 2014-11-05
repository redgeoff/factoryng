'use strict';

var Firyng = require('../../../scripts/adapters/firyng'), YngAdapter = require('../yng-adapter');

var adapter = new YngAdapter('Firyng', 'https://firyng.firebaseio.com');
adapter.AdapterFactory = Firyng;
adapter.run();