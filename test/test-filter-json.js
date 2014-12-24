/**
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

var JsonFilter = require('../filters').JsonFilter;

module.exports = {
    'setUp': function(done) {
        this.uniqid = Math.floor(Math.random() * 0x100000000).toString(16);
        this.template = {
            host: 'hostname',
            uniqid: this.uniqid,
        };
        this.jsonFilter = new JsonFilter(this.template);
        this.filter = function(msg, level){ return this.jsonFilter.filter(msg, level) };
        done();
    },

    'makeFilter should return bound filter function': function(t) {
        var filter = JsonFilter.makeFilter({a: 1, b: 2});
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

    'should emit valid json object': function(t) {
        var json = this.filter("log line text", 6);
        t.ok(json);
        t.equal(json[0], '{');
        t.equal(json[json.length-1], '}');
        t.equal(typeof JSON.parse(json), 'object');
        t.done();
    },

    'should add timestamp': function(t) {
        var t1 = Date.now();
        var bundle = JSON.parse(this.filter("", 6));
        var t2 = Date.now();
        t.ok(t1 <= bundle.time && bundle.time <= t2);
        t.done();
    },

    'should add loglevel': function(t) {
        var bundle = JSON.parse(this.filter("", 6));
        t.equal(bundle.level, 'info');
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

    'should accept object for message': function(t) {
        var obj = {a:1, b:2, c:3};
        var bundle = JSON.parse(this.filter(obj, 6));
        t.equal(bundle.b, 2);
        t.equal(bundle.c, 3);
        t.equal(bundle.level, 'info');
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
};
