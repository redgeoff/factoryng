'use strict';

describe('Service: yng-utils', function () {

  // load the service's module
  beforeEach(module('factoryng'));

  // instantiate service
  var yngutils;
  beforeEach(inject(function (_yngutils_) {
    yngutils = _yngutils_;
  }));

  it('should replace', function() {
    var docs = [];
    var oldDoc = { description: 'take out trash', priority: 'low' };
    var newDoc = { description: 'clean dishes', due: 'now' };
    docs.push(oldDoc);
    yngutils.replace(docs[0], newDoc);
    expect(docs[0]).toEqual(newDoc);
  });

  it('should detect strings', function() {
    expect(yngutils.isString('some string')).toBe(true);
    expect(yngutils.isString({})).toBe(false);
    expect(yngutils.isString(123)).toBe(false);
    expect(yngutils.isString('123')).toBe(true);
  });

  it('should detect numbers', function() {
    expect(yngutils.isNumeric('some string')).toBe(false);
    expect(yngutils.isNumeric('123f')).toBe(false);
    expect(yngutils.isNumeric({})).toBe(false);
    expect(yngutils.isNumeric(123)).toBe(true);
    expect(yngutils.isNumeric('123')).toBe(true);
  });

  it('should detect undefined', function() {
    expect(yngutils.notDefined()).toBe(true);
    expect(yngutils.notDefined('')).toBe(false);
    expect(yngutils.notDefined(123)).toBe(false);
    expect(yngutils.notDefined({})).toBe(false);
  });

  it('should clone', function() {
    var doc = { description: 'take out trash', priority: 'low' };
    var clonedDoc = yngutils.clone(doc);
    clonedDoc.description = 'clean dishes';
    expect(doc).toEqual({ description: 'take out trash', priority: 'low' });
  });

});
