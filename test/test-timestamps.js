/**
 * Copyright (C) 2014-2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var assert = require('assert');

var filters = require('../filters');
var timestamps = require('../lib/timestamps');


module.exports = {
    'should pad2': function(t) {
        assert.equal(timestamps.pad2(1), '01');
        assert.equal(timestamps.pad2(12), '12');
        assert.equal(timestamps.pad2(123), '123');
        t.done();
    },

    'should pad3': function(t) {
        assert.equal(timestamps.pad3(1), '001');
        assert.equal(timestamps.pad3(12), '012');
        assert.equal(timestamps.pad3(123), '123');
        assert.equal(timestamps.pad3(1234), '1234');
        t.done();
    },

    'should pad4': function(t) {
        assert.equal(timestamps.pad4(1), '0001');
        assert.equal(timestamps.pad4(12), '0012');
        assert.equal(timestamps.pad4(123), '0123');
        assert.equal(timestamps.pad4(1234), '01234');
        assert.equal(timestamps.pad4(12345), '12345');
        t.done();
    },

    'should return timestamp': function(t) {
        // setTimeout expire the current timestamp, to guarantee fresh
        var t1 = Date.now();
        setTimeout(function() {
            var time = timestamps.getTimestamp();
            var t2 = Date.now();
            t.ok(t1 <= time);
            t.ok(time <= t2);
            t.done();
        });
    },

    'should return timestamp async': function(t) {
        var t1 = Date.now();
        timestamps.getTimestampAsync(function(err, time) {
            var t2 = Date.now();
            // NOTE: can return a timestamp up to 1 ms off, setTimeout is not synchronized to the clock
            t.ok(t1 - 1 <= time);
            t.ok(time <= t2);
            t.done();
        });
    },

    'should return timestamp async without setImmediate too': function(t) {
        var setImmediate = global.setImmediate;
        delete global.setImmediate;
        t.unrequire('../lib/timestamps');
        var timestamps = require('../lib/timestamps');
        var t1 = Date.now();
        timestamps.getTimestampAsync(function(err, time) {
            global.setImmediate = setImmediate;
            var t2 = Date.now();
            t.ok(t1 - 1 <= time);
            t.ok(time <= t2);
            t.done();
        });
    },

    'should format ISO timestamp': function(t) {
        var msg = filters.formatIsoDate(980271296000);
        assert.equal(msg, '2001-01-23 12:34:56');
        setTimeout(function() {
            var t1 = Date.now();
            t.ok(t1 - t1 % 1000 <= new Date(filters.formatIsoDate()).getTime());
            t.ok(new Date(filters.formatIsoDate()) <= new Date());
            t.done();
        })
    },

    'should format ISO UTC timestamp': function(t) {
        var msg = filters.formatIsoDateUtc(980271296000);
        assert.equal(msg, '2001-01-23 17:34:56');
        setTimeout(function() {
            var t1 = Date.now();
            t.ok(t1 - t1 % 1000 <= new Date(filters.formatIsoDateUtc() + ' UTC').getTime());
            t.ok(new Date(filters.formatIsoDateUtc() + ' UTC') <= new Date());
            t.done();
        })
    },

    'should format numeric date': function(t) {
        var msg = filters.formatNumericDateUtc(980271296123);
        assert.equal(msg, '20010123173456.123');
        assert.equal(filters.formatNumericDateUtc(980271296124), '20010123173456.124');
        assert.equal(filters.formatNumericDateUtc(980271297124), '20010123173457.124');
        setTimeout(function() {
            var t1 = filters.formatNumericDateUtc();
            t.ok(+t1 <= +filters.formatNumericDateUtc());
            t.ok(+filters.formatNumericDateUtc() <= +t1 + .005);
            t.done();
        })
    },

    'should format js iso timestamp': function(t) {
        var msg = filters.formatJsDateIsoString(980271296123);
        assert.equal(msg, '2001-01-23T17:34:56.123Z');
        assert.equal(msg, new Date(980271296123).toISOString());
        setTimeout(function() {
            var t1 = Date.now();
            t.ok(t1 <= new Date(filters.formatJsDateIsoString()).getTime());
            t.ok(new Date(filters.formatJsDateIsoString()) <= new Date());
            t.done();
        })
    },

    'should format basic timestamp': function(t) {
        var msg = filters.formatBasicDate(980271296123);
        t.equal(msg, '2001-01-23 12:34:56.123');
        setTimeout(function() {
            var t1 = Date.now();
            t.ok(t1 <= new Date(filters.formatBasicDate()).getTime());
            t.ok(new Date(filters.formatBasicDate()) <= new Date());
            t.done();
        })
    },

    'should format raw timestamp': function(t) {
        t.equal(filters.formatRawTimestamp(1234), '1234');
        t.equal(filters.formatRawTimestamp(980271296123), '980271296123');
        var now = Date.now();
        t.ok(filters.formatRawTimestamp() >= now - 5);
        t.done();
    },

    'should format json timestamp': function(t) {
        t.equal(filters.formatJsonDate(1234), '1970-01-01T00:00:01.234Z');
        t.equal(filters.formatJsonDate(980271296123), '2001-01-23T17:34:56.123Z');
        var now = new Date();
        var ts = filters.formatJsonDate();
        // allow for 5ms getTimestamp() inaccuracy
        t.ok(new Date(ts) >= now - 5 && new Date(ts) <= new Date());
        t.done();
    },

    'Timebase': {
        'should export expected methods': function(t) {
            t.equal(typeof timestamps.test.Timebase, 'function');
            var tbase = new timestamps.test.Timebase();
            t.equal(typeof tbase.getTimestamp, 'function');
            t.equal(typeof tbase.getTimestampAsync, 'function');
            t.done();
        },

        'should fetch the current timestamp with refresh': function(t) {
            var tbase = new timestamps.test.Timebase();
            var stub = t.stub(tbase, 'refresh', function(){ this.timestamp = 12345; return true });
            t.equal(tbase.getTimestamp(), 12345);
            stub.restore();
            t.done();
        },

        'reresh should start only one timeout timer': function(t) {
            var timebase = new timestamps.test.Timebase();
            t.ok(!timebase.timeoutTimer);
            timebase.refresh();
            var timer1 = timebase.timeoutTimer;
            t.ok(timer1);
            timebase.refresh();
            var timer2 = timebase.timeoutTimer;
            t.ok(timer2);
            t.ok(timer1 === timer2);
            t.done();
        },
    },

    'speed': {
        'format 100k formatIsoDate': function(t) {
            for (var i=0; i<100000; i++) filters.formatIsoDate(980271296000);
            t.done();
        },

        'format 100k numericDateUtc': function(t) {
            for (var i=0; i<100000; i++) filters.formatNumericDateUtc(980271296000);
            t.done();
        },

        'format 100k jsDateIsoString': function(t) {
            for (var i=0; i<100000; i++) filters.formatJsDateIsoString(980271296000);
            t.done();
        },

        'format 100k Date.toISOString': function(t) {
            var i, dt = new Date(980271296000);
            for (i=0; i<100000; i++) dt.toISOString();
            t.done();
        },
    },
};
