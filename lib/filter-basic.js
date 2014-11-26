/**
 * basic logging filter, adds a timestamp and the loglevel
 *
 * exports a simple filter function
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

/* global global */

var QLogger = require('./qlogger.js');
var formatIsoDate = require('./format-timestamp.js').formatIsoDate;
var pad3 = require('./format-timestamp.js').pad3;

var _datetime = "";
var _timestamp = "";

var singleton = new BasicFilter();
module.exports = function filterBasic(message, loglevel) {
    return singleton.filter(message, loglevel);
}
module.exports.BasicFilter = BasicFilter;


function BasicFilter( ) {
    if (this === global || !this) return new BasicFilter();

    this.datetime = "";
    this.timestamp = "";
}

BasicFilter.prototype.filter = function( message, loglevel ) {
    var msec = Date.now();
    var sec = msec - msec % 1000;
    if (sec != this.timestamp) {
        this.datetime = formatIsoDate(sec);
        this.timestamp = sec;
    }

    // 2014-10-19 01:23:45.678 [info] Hello, world.
    return this.datetime + "." + pad3(msec % 1000) + " [" + QLogger.LEVELNAMES[loglevel] + "] " + message;
};
