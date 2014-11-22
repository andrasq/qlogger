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

var _datetime = "";
var _timestamp = "";

module.exports = function basicFilter( message, loglevel ) {
    var msec = Date.now();
    msec000 = msec - msec % 1000;
    if (msec000 != _timestamp) _datetime = isoDate(_timestamp = msec000);

    // 2014-10-19 01:23:45.678 [info] Hello, world.
    return _datetime + "." + pad3(msec % 1000) + " [" + QLogger.LEVELNAMES[loglevel] + "] " + message;
};


// format "2014-10-19 01:23:45"
function isoDate( millisec ) {
    var dt = new Date(millisec);
    var datetime =
        dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" + pad2(dt.getSeconds());
    return datetime;
}

function pad2( number ) {
    return number >= 10 ? number : "0" + number;
}

function pad3( number ) {
    return number >= 100 ? number : "0" + pad2(number);
}


// quick test:
/**
var s, i, t1;
t1 = Date.now();
for (i=0; i<2000000; i++) {
    s = module.exports("Hello, world.", 6);
}
console.log(Date.now()-t1, s);
// 3.3m/s filters/sec
/**/
