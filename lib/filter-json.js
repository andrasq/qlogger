/**
 * basic json logging filter, adds a timestamp and the loglevel
 *
 * exports a class with a single method filter().  The class is to
 * hold the format template (hostname, app name, request id, etc).
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

QLogger = require('./qlogger.js');

module.exports = JsonFilter;

function JsonFilter( template ) {
    var defaultTemplate = {time: 0, level: '', message: ''};
    this.template = typeof template === 'object' ? template : defaultTemplate;
}

JsonFilter.makeFilter = function makeFilter( template ) {
    var jsonFilter = new JsonFilter(template);
    return function(message, loglevel) { return jsonFilter.filter(message, loglevel) };
}
// alias
JsonFilter.createFilter = JsonFilter.makeFilter;

JsonFilter.prototype.filter = function filter( message, loglevel ) {
    var i, bundle = {};

    for (i in this.template) {
        bundle[i] = this.template[i];
    }

    // always include a timestamp and the log level, and error details
    bundle.time = Date.now();
    bundle.level = QLogger.LEVELNAMES[loglevel];
    if (message instanceof Error) {
        bundle.message = 'Error: ' + message.message;
        bundle.error = {
            code: message.code,
            message: message.message,
            stack: message.stack
        };
    }

    if (typeof message !== 'object') message = {message: message};

    for (i in message) {
        bundle[i] = message[i];
    }

    return JSON.stringify(bundle);
};


// quick test:
/**
var s, i, t1 = Date.now();;
var filter = JsonFilter.makeFilter();
for (i=0; i<100000; ++i) {
    s = filter("Hello, world.", 6);
}
console.log(Date.now()-t1, s);
// 470k/s for 1m filters/sec, 455k/s for 100k
/**/
