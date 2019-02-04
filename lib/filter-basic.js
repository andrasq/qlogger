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
var timestamps = require('./timestamps');


function BasicFilter( ) {
    this.datetime = "";
    this.timestamp = "";
}

BasicFilter.prototype.filter = function( message, loglevel ) {
    // 2014-10-19 01:23:45.678 [info] Hello, world.
    var timestring = timestamps.formatBasicDate();
    return timestring + " [" + QLogger.LEVELNAMES[loglevel] + "] " + message;
};

BasicFilter.create = function create( ) {
    var filter = new BasicFilter();
    return function(message, level) { return filter.filter(message, level) }
}


// for historical reasons filter-basic exports the default filter function
// The other filters export the filter class with a .create() builder method.
module.exports = BasicFilter.create();
module.exports.BasicFilter = BasicFilter;
