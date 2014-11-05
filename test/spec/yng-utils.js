'use strict';

var expect = require('expect'), Q = require('q'), YngUtils = require('../../scripts/yng-utils');

describe('yng-utils', function () {

  var yngutils;
  beforeEach(function () {
    yngutils = new YngUtils(Q);
  });

  it('should replace', function () {
    var docs = [];
    var oldDoc = { description: 'take out trash', priority: 'low' };
    var newDoc = { description: 'clean dishes', due: 'now' };
    docs.push(oldDoc);
    yngutils.replace(docs[0], newDoc);
    expect(docs[0]).toEqual(newDoc);
  });

  it('should detect strings', function () {
    expect(yngutils.isString('some string')).toBe(true);
    expect(yngutils.isString({})).toBe(false);
    expect(yngutils.isString(123)).toBe(false);
    expect(yngutils.isString('123')).toBe(true);
  });

  it('should detect numbers', function () {
    expect(yngutils.isNumeric('some string')).toBe(false);
    expect(yngutils.isNumeric('123f')).toBe(false);
    expect(yngutils.isNumeric({})).toBe(false);
    expect(yngutils.isNumeric(123)).toBe(true);
    expect(yngutils.isNumeric('123')).toBe(true);
  });

  it('should detect undefined', function () {
    expect(yngutils.notDefined()).toBe(true);
    expect(yngutils.notDefined('')).toBe(false);
    expect(yngutils.notDefined(123)).toBe(false);
    expect(yngutils.notDefined({})).toBe(false);
  });

  it('should clone', function () {
    var doc = { description: 'take out trash', priority: 'low' };
    var clonedDoc = yngutils.clone(doc);
    clonedDoc.description = 'clean dishes';
    expect(doc).toEqual({ description: 'take out trash', priority: 'low' });
  });

  it('should merge', function () {
    var x = { a: 1, b: 2 }, y = { b: 3, c: 4 };
    expect(yngutils.merge(x, y)).toEqual({ a: 1, b: 3, c: 4 });
    expect(yngutils.merge(null, null)).toEqual({});    
  });

  it('should get', function () {
    var items = {
      a: 1,
      b: {
        b1: 2
      }
    };
    // expect(yngutils.get()).not.toBeDefined();
    yngutils.notDefined(yngutils.get()).should.be.true;
    expect(yngutils.get(null)).toEqual(null);
    // expect(yngutils.get(null, 'huh')).toEqual(null);
    yngutils.notDefined(yngutils.get(null, 'huh')).should.be.true;
    // expect(yngutils.get(items, 'missing')).not.toBeDefined();
    yngutils.notDefined(yngutils.get(items, 'missing')).should.be.true;
    expect(yngutils.get(items, 'a')).toEqual(1);
    expect(yngutils.get(items, 'b')).toEqual({ b1: 2 });
    expect(yngutils.get(items, 'b', 'b1')).toEqual(2);
  });

});
