'use strict';

var expect = require('expect'), Q = require('q'), sinon = require('sinon'),
    utils = require('./utils'), YngUtils = require('../../scripts/yng-utils'),
    YngFactory = require('../../scripts/yng');

describe('Yng', function () {
  
  var yngutils, Yng, yng, $q = Q, $timeout = utils.timeout;
  // Replace $q with Q as $q requires manual manipulation of the digest and other pieces in karma
  // Mock $timeout so that it doesn't require a $timeout.flush()
  yngutils = new YngUtils($q);
  Yng = new YngFactory($q, $timeout);

  var google = null, amazon = null;
  function populate(sortBy) {
    google = { $id: 111, name: 'Google', url: 'http://www.google.com', $priority: 2 };
    amazon = { $id: 222, name: 'Amazon', url: 'http://www.amazon.com', $priority: 1 };
    yng = new Yng('website', 'http://example.com', sortBy);
    yng.push(google);
    yng.push(amazon);    
  }

  beforeEach(function () {
    populate();
  });

  it('should sort if needed', function () {
    yng.sortIfNeeded();

    yng.sortBy = yngutils.ASC;
    yng.sortIfNeeded();
    expect(yng.at(0)).toEqual(amazon);
    expect(yng.at(1)).toEqual(google);

    yng.sortBy = yngutils.DESC;
    yng.sortIfNeeded();
    expect(yng.at(0)).toEqual(google);
    expect(yng.at(1)).toEqual(amazon);   

    yng.sortBy = function (a, b) {
      return a.name > b.name ? 1 : -1;
    };
    yng.sortIfNeeded();
    expect(yng.at(0)).toEqual(amazon);
    expect(yng.at(1)).toEqual(google);
  });

  it('sort soon should only sort once', function () {
    populate(yngutils.ASC);
    yng.sortSoonIfNeeded();
    yng.sortSoonIfNeeded();
    yng.sortSoonIfNeeded();
    expect(yng.at(0)).toEqual(google);
    expect(yng.at(1)).toEqual(amazon); 
    return utils.timeout(1000).then(function () {
      expect(yng.at(0)).toEqual(amazon);
      expect(yng.at(1)).toEqual(google);
    });
  });

  it('should set', function () {
    var foo = { $id: 123 };
    yng.set(foo);
    // expect(yng.get(123)).not.toBeDefined();
    yngutils.notDefined(yng.get(123)).should.be.true;

    var clonedGoogle = yngutils.clone(google);
    delete(clonedGoogle.$priority);
    clonedGoogle.location = 'CA';
    yng.set(clonedGoogle);
    expect(yng.get(clonedGoogle.$id)).toEqual(clonedGoogle);
    clonedGoogle.location = 'WA';
    yng.setProperty(clonedGoogle.$id, 'location', clonedGoogle.location);
    expect(yng.get(clonedGoogle.$id)).toEqual(clonedGoogle);
  });

  it('should not push if exists', function () {
    yng.push(google);
    expect(yng.length()).toEqual(2);
  });

  it('should remove', function () {
    yng.remove(google.$id);
    expect(yng.length()).toEqual(1);
    expect(yng.at(0)).toEqual(amazon);
    // expect(yng.get(google.$id)).not.toBeDefined();
    yngutils.notDefined(yng.get(google.$id)).should.be.true;
  });

  it('should bind', function () {
    var scope = {};
    return yng.bindModel(scope).then(function () {
      expect(scope[yng.name][0]).toEqual(google);
      expect(scope[yng.name][1]).toEqual(amazon);
    });
  });

  it('should applyFactory', function () {
    var name = yngutils.clone(yng.name);
    var factory = yng.applyFactory(function (x, y) {
      expect(this.name).toEqual(name);
      expect(x).toEqual(7);
      expect(y).toEqual(8);
    });
    factory(7, 8);
  });

  it('should toId', function () {
    expect(yng.toId({ $id: 123 })).toEqual(123);
    expect(yng.toId(123)).toEqual(123);
    expect(yng.toId('123')).toEqual('123');
    expect(yng.toId('123abc123')).toEqual('123abc123');

    expect(function () {
      yng.toId({ foo: 'boo' });
    }).toThrow();
  });

  it('should forEach', function () {
    var obj = {
      foo: 'bar'
    };
    yng.forEach(function (el, i) {
      expect(el).toEqual(i === 0 ? google : amazon);
      expect(this.foo).toEqual(obj.foo);
    }, obj);
  });

  it('should cleanup', function () {
    return yng.cleanup();
  });

  it('should copyApi', function () {
    var obj = {};
    yng.copyApi(obj);
    // expect(obj.at).toBeDefined();
    yngutils.notDefined(obj.at).should.be.false;
    expect(obj.at(0)).toEqual(google);
  });

  it('should not emit without scope', function () {
    yng.createDoc({ foo: 'bar' });
  });

  it('should setPriorityIfNeeded', function () {
    var doc = { $id: 123 };
    yng.setPriorityIfNeeded(doc);
    expect(doc.$priority).toEqual(2);

    doc.$priority = 1;
    yng.setPriorityIfNeeded(doc);
    expect(doc.$priority).toEqual(1);
  });

  it('should get provider', function () {
    yng.provider();
  });

  it('should destroy', function () {
    yng.destroy().then(function () {
      expect(yng.length() === 0);
    });
  });

  it('should error', function () {
    yng.on('error', function (err) {
      expect(err).toEqual('some error');
    });
    yng.error('some error');
  });

  it('should nextId', function () {
    var id = yng.nextId();
    expect(id).toEqual(1);
    var yng2 = new Yng('website', 'http://example.com');
    id = yng2.nextId();
    expect(id).toEqual(2);
  });

  it('should be bound', function () {
    yng.bound();
  });

  it('should set and get properties', function () {
    yng.properties({ foo: 'bar' });
    expect(yng.properties()).toEqual({ foo: 'bar' });
  });

  it('should have unique emitters', function () {
    var yng1 = new Yng('website1', 'http://example1.com'),
        yng2 = new Yng('website2', 'http://example2.com');
    var onError1 = sinon.spy();
    yng1.on('error', onError1);
    yng2.on('error', function () {
      // needed or else mocha expects event handler
    });
    yng2.error('some error');
    return utils.timeout(1000).then(function () {
      onError1.called.should.equal.false;
    });
  });

});