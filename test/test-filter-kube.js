'use strict';

var filters = require('../filters');

module.exports = {
    'should exports class and builder': function(t) {
        t.equal(typeof filters.KubeFilter, 'function');
        t.equal(typeof filters.KubeFilter.create, 'function');
        t.equal(typeof filters.KubeFilter.create(), 'function');
        t.done();
    },

    'should log strings': function(t) {
        var filter = filters.KubeFilter.create('test');
        var str = filter("my log message");
        t.contains(str, '"message":"my log message"');
        t.done();
    },

    'should log objects': function(t) {
        var filter = filters.KubeFilter.create('test');
        var str = filter({ a: 1, b: "test message" });
        t.contains(str, '"message":{"a":1,"b":"test message"}');
        t.done();
    },

    'should add timestamp and type and message': function(t) {
        var filter = filters.KubeFilter.create('myLogStream');
        var str = filter("test message", "info");
        t.contains(str, '"time":');
        t.contains(str, '"type":"myLogStream",');
        t.contains(str, '"message":"test message"');
        t.notContains(str, '"level"');
        t.ok(JSON.parse(str));
        t.done();
    },

    'should optionally include loglevel': function(t) {
        var filter = filters.KubeFilter.create({ type: 'myLogStream', level: true });
        var str = filter({m: "test message"}, 4);
        t.contains(str, '"level":"warning"');
        t.contains(str, '"time":');
        t.contains(str, '"type":"myLogStream",');
        t.contains(str, '"message":{"m":"test message"}');
        t.ok(JSON.parse(str));
        t.done();
    },

    'should tolerate unserializable objects': function(t) {
        var filter = filters.KubeFilter.create('test');
        var obj = {}; obj.self = obj;
        var str = filter(obj);
        t.contains(str, '"time":');
        t.contains(str, '"type":"test",');
        t.contains(str, '"message":"[unserializable object]"');
        t.ok(JSON.parse(str));
        t.done();
    },
}
