/**
 * basic logging filter, adds a timestamp and the loglevel
 *
 * exports a simple filter function
 *
 * Copyright (C) 2014,2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var QLogger = require('./qlogger.js');
var formatIsoDate = require('./format-timestamp.js').formatIsoDate;
var pad3 = require('./format-timestamp.js').pad3;

// for historical reasons filter-basic exports the default filter function
// The other filters export the filter class with a .create() builder method.
var singleton = new BasicFilter();
module.exports = function filterBasic(message, loglevel) {
    return singleton.filter(message, loglevel);
}
module.exports.BasicFilter = BasicFilter;


function BasicFilter( ) {
    this.datetime = "";
    this.timestamp = "";
}

BasicFilter.prototype.filter = function( message, loglevel ) {
    var now = Date.now();
    var sec = now - now % 1000;
    if (sec != this.timestamp) {
        this.datetime = formatIsoDate(sec);
        this.timestamp = sec;
    }

    // 2014-10-19 01:23:45.678 [info] Hello, world.
    return this.datetime + "." + pad3(now % 1000) + " [" + QLogger.LEVELNAMES[loglevel] + "] " + message;
};

BasicFilter.create = function create( ) {
    var filter = new BasicFilter();
    return function(message, level) { return filter.filter(message, level) }
}
