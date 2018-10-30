/**
 * basic json logging filter, adds a timestamp and the loglevel
 *
 * exports a class with a single method that builds the filter function.
 * The function is wrapped around a closure that holds the format template.
 *
 * Copyright (C) 2014-2016 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var QLogger = require('./qlogger.js');

module.exports = JsonFilter;

function JsonFilter( template, opts ) {
    var defaultTemplate = {time: 0, level: '', message: ''};
    this.template = typeof template === 'object' ? template : defaultTemplate;
    this.Bundle = function(){};
    this.Bundle.prototype = this.template;
    this.encode = opts && opts.encode || JSON.stringify;
    this.includeLoglevel = (this.template.level !== false);
    if (!this.includeLoglevel) delete this.template.level;
}

JsonFilter.makeFilter = function makeFilter( template, opts ) {
    var jsonFilter = new JsonFilter(template, opts);
    return function(message, loglevel) { return jsonFilter.filter(message, loglevel) };
}
JsonFilter.createFilter = JsonFilter.makeFilter;

JsonFilter.prototype.filter = function filter( message, loglevel ) {
    var i, bundle;

    bundle = new this.Bundle();
    // move the template vars to the front.  Without explicit store,
    // they show up at the end of a for i in loop, and not at all in JSON
    for (i in bundle) bundle[i] = bundle[i];

    // always include a timestamp and the log level, and error details
    bundle.time = (message && message.time) ? 0 : Date.now();
    if (this.includeLoglevel) bundle.level = QLogger.LEVELNAMES[loglevel];
    if (message instanceof Error) {
        bundle.message = 'Error: ' + message.message;
        bundle.error = {
            // Error is magic, none of its fields stringify: copy them out
            code: message.code,
            message: message.message,
            stack: message.stack
        };
    }

    if (typeof message !== 'object') {
        bundle.message = message;
    }
    else for (i in message) {
        bundle[i] = message[i];
    }

    return this.encode(bundle);
};
