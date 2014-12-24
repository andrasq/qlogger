/**
 * basic json logging filter, adds a timestamp and the loglevel
 *
 * exports a class with a single method that builds the filter function.
 * The function is wrapped around a closure that holds the format template.
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

QLogger = require('./qlogger.js');

module.exports = JsonFilter;

function JsonFilter( template, opts ) {
    var defaultTemplate = {time: 0, level: '', message: ''};
    this.template = typeof template === 'object' ? template : defaultTemplate;
    this.encode = opts && opts.encode || JSON.stringify;
}

JsonFilter.makeFilter = function makeFilter( template, opts ) {
    var jsonFilter = new JsonFilter(template, opts);
    return function(message, loglevel) { return jsonFilter.filter(message, loglevel) };
}
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

    return this.encode(bundle);
};
