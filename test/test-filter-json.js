/**
 * Copyright (C) 2014.2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

var JsonFilter = require('../filters').JsonFilter;

module.exports = {
    'setUp': function(done) {
        this.uniqid = Math.floor(Math.random() * 0x100000000).toString(16);
        this.template = {
            host: 'hostname',
            uniqid: this.uniqid,
            level: true,
        };
        this.jsonFilter = new JsonFilter({ template: this.template });
        this.filter = function(msg, level){ return this.jsonFilter.filter(msg, level) };
        done();
    },

    'makeFilter should return bound filter function': function(t) {
        var filter = JsonFilter.makeFilter({a: 1, b: 2, level: true});
        var bundle = JSON.parse(filter("log line text", 7));
        t.equal(bundle.level, 'debug');
        t.equal(1, bundle.a);
        t.done();
    },

    'makeFilter should use configured encoder': function(t) {
        var ncalls = 0;
        var encode = function testStringify(msg, level){ ncalls++; return JSON.stringify(msg) };
        var filter = JsonFilter.makeFilter({}, {encode: encode});
        filter("message one", 3);
        filter("message two", 3);
        t.equal(2, ncalls);
        t.done();
    },

    'should emit valid json object with the string as the message': function(t) {
        var json = this.filter("log line text", 6);
        t.ok(json);
        t.equal(json[0], '{');
        t.equal(json[json.length-1], '}');
        t.equal(typeof JSON.parse(json), 'object');
        t.equal(JSON.parse(json).message, 'log line text');
        t.done();
    },

    'should add timestamp': function(t) {
        var t1 = Date.now();
        var bundle = JSON.parse(this.filter("", 6));
        var t2 = Date.now();
        var time = new Date(bundle.time).getTime();
        t.ok(t1-5 <= time && time <= t2);
        t.done();
    },

    'should use provided timestamp': function(t) {
        var bundle = JSON.parse(this.filter({ time: 12345 }, 6));
        t.equal(bundle.time, 12345);
        t.done();
    },

    'should add loglevel': function(t) {
        var bundle = JSON.parse(this.filter("", 6));
        t.equal(bundle.level, 'info');
        t.done();
    },

    'should omit loglevel if so configured': function(t) {
        var filter = JsonFilter.makeFilter({a: 2, level: false});
        var bundle = JSON.parse(filter("log line text", 7));
        t.strictEqual(bundle.level, undefined);
        t.equal(2, bundle.a);
        t.done();
    },

    'should include message': function(t) {
        var i, buff = new Buffer(127);
        for (i=0; i<128; i++) buff[i] = i;
        var bundle = JSON.parse(this.filter(buff.toString(), 6));
        t.equal(bundle.message, buff.toString());
        t.done();
    },

    'should include template': function(t) {
        var bundle = JSON.parse(this.filter("", 6));
        t.equal(bundle.host, 'hostname');
        t.equal(bundle.uniqid, this.uniqid);
        t.done();
    },

    'should use all defaults': function(t) {
        var filter = new JsonFilter();
        t.strictEqual(filter.includeTime, true);
        t.strictEqual(filter.includeLoglevel, true);
        t.strictEqual(filter.template.message, undefined);
        t.done();
    },

    'should makeFilter with all defaults': function(t) {
        var filterFunction = JsonFilter.makeFilter();
        var filtered = filterFunction('my test message');
        t.contains(filtered, '"time":');
        t.contains(filtered, '"level":');
        t.contains(filtered, '"my test message"');
        t.done();
    },

    'should still add timestamp and level with empty template': function(t) {
        var filterFunction = JsonFilter.makeFilter({});
        var filtered = filterFunction('my test message');
        t.contains(filtered, '"time":');
        t.contains(filtered, '"level":');
        t.contains(filtered, '"message":');
        t.done();
    },

    'should be able to turn off all default fields': function(t) {
        var filter = JsonFilter.makeFilter({ time: false, level: false });
        t.equal(filter({}), "{}");
        t.equal(filter('my test message'), '{"message":"my test message"}');
        t.done();
    },

    'should accept object for message': function(t) {
        var obj = {a:1, b:2, c:3};
        var bundle = JSON.parse(this.filter(obj, 6));
        t.equal(bundle.b, 2);
        t.equal(bundle.c, 3);
        t.equal(bundle.level, 'info');
        t.done();
    },

    'should log a string as the message': function(t) {
        var bundle = JSON.parse(this.filter('test ' + this.uniqid, 6));
        t.equal(bundle.message, 'test ' + this.uniqid);
        t.done();
    },

    'should log error, message and stack from error objects': function(t) {
        var err = new Error("log error");
        var bundle = JSON.parse(this.filter(err, 6));
        t.ok(bundle.message.indexOf('Error:') === 0);
        t.ok(bundle.error);
        t.ok(bundle.error.message === 'log error');
        t.ok(bundle.error.stack);
        t.done();
    },

    'should tolerate unserializable objects': function(t) {
        var obj = {};
        obj.self = obj;
        var bundle = JSON.parse(this.filter(obj, 6));
        t.equal(bundle.message, '[unserializable object]');
        t.done();
    },

    'test 100k filter-json': function(t) {
        var ret;
        for (var i = 0; i<100000; i++) {
            ret = this.filter({a: 1, b: 2});
        }
        t.done();
        // 875k/s
    },
};
