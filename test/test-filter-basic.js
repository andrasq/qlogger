/**
 * Copyright (C) 2014,2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

var BasicFilter = require('../filters').BasicFilter;
var filter = require('../filters').filterBasic;

module.exports = {
    'should export class and builder': function(t) {
        t.equal(typeof filter, 'function');
        t.equal(typeof BasicFilter, 'function');
        t.equal(typeof BasicFilter.create, 'function');
        t.equal(typeof BasicFilter.create(), 'function');
        t.done();
    },

    'should add timestamp and loglevel': function(t) {
        var year = new Date().getFullYear();
        var msg = filter("my test message", 6);
        t.equal(msg.indexOf(year), 0);
        t.ok(/^\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d\.\d\d\d \[info\] my test message/.test(msg));
        t.done();
    },

    'should add loglevel': function(t) {
        var msg = filter("test", 6);
        t.ok(msg.indexOf('[info]') > 0);
        t.done();
    },

    'should include message': function(t) {
        var i, buff = new Buffer(127);
        for (i=0; i<128; i++) buff[i] = i;
        var msg = filter(buff.toString(), 6);
        t.ok(msg.indexOf(buff.toString()) > 0);
        t.done();
    },
};
