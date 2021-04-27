'use strict';

var filters = require('../filters');

module.exports = {
    'should exports class and builder': function(t) {
        t.equal(typeof filters.PinoFilter, 'function');
        t.equal(typeof filters.PinoFilter.create, 'function');
        t.equal(typeof filters.PinoFilter.create(), 'function');
        t.done();
    },

    'can construct without args': function(t) {
        t.ok(new filters.PinoFilter());
        t.done();
    },

    'should log strings': function(t) {
        var filter = filters.PinoFilter.create('test');
        var str = filter("my log message");
        t.contains(str, '"msg":"my log message"');
        t.done();
    },

    'should log objects': function(t) {
        var filter = filters.PinoFilter.create('test');
        var str = filter({ a: 1, b: "test message" });
        t.contains(str, '"a":1,"b":"test message"');
        t.done();
    },

    'should add timestamp and level and name and message': function(t) {
        var filter = filters.PinoFilter.create({ name: 'myLogStream' });
        var str = filter("test message", 6);
        t.contains(str, '"time":');
        t.contains(str, '"name":"myLogStream",');
        t.contains(str, '"msg":"test message"');
        t.contains(str, '"level":30,');
        t.ok(JSON.parse(str));
        t.done();
    },
}
