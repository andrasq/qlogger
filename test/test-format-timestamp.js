/**
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

assert = require('assert');

formatIsoDate = require('../filters').formatIsoDate;
formatIsoDateUtc = require('../filters').formatIsoDateUtc;
pad2 = require('../lib/format-timestamp').pad2;
pad3 = require('../lib/format-timestamp').pad3;
pad4 = require('../lib/format-timestamp').pad4;


module.exports = {
    'should pad2': function(t) {
        assert.equal(pad2(1), '01');
        assert.equal(pad2(12), '12');
        assert.equal(pad2(123), '123');
        t.done();
    },

    'should pad3': function(t) {
        assert.equal(pad3(1), '001');
        assert.equal(pad3(12), '012');
        assert.equal(pad3(123), '123');
        assert.equal(pad3(1234), '1234');
        t.done();
    },

    'should pad4': function(t) {
        assert.equal(pad4(1), '0001');
        assert.equal(pad4(12), '0012');
        assert.equal(pad4(123), '0123');
        assert.equal(pad4(1234), '01234');
        assert.equal(pad4(12345), '12345');
        t.done();
    },

    'should format ISO timestamp': function(t) {
        var msg = formatIsoDate(980271296000);
        assert.equal(msg, '2001-01-23 12:34:56');
        t.done();
    },

    'should format ISO UTC timestamp': function(t) {
        var msg = formatIsoDateUtc(980271296000);
        assert.equal(msg, '2001-01-23 17:34:56');
        t.done();
    },

    'speed': {
        'format 100k timestamps': function(t) {
            var i;
            for (i=0; i<100000; i++) formatIsoDate(980271296000);
            t.done();
        },

        'format 100k Date.toString': function(t) {
            var i;
            for (i=0; i<100000; i++) new Date(980271296000).toString();
            t.done();
        },
    },
};
