/**
 * basic json logging filter, adds a timestamp and the loglevel
 *
 * exports a class with a single method that builds the filter function.
 * The function is wrapped around a closure that holds the format template.
 *
 * Copyright (C) 2014-2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var os = require('os');
var QLogger = require('./qlogger.js');

module.exports = JsonFilter;
module.exports.KubeFilter = KubeFilter;
module.exports.PinoFilter = PinoFilter;
var timestamps = require('./timestamps');

function JsonFilter( options ) {
    options = options || {};
    var defaultTemplate = { time: 0, level: '', message: undefined };
    this.template = (typeof options.template === 'object') ? copyObject({}, options.template) : defaultTemplate;
    this.encode = options.encode || JSON.stringify;
    this.getTimestamp = options.timestamp || function() { return timestamps.getTimestamp() };
    this.includeTime = (this.template.time !== false);
    this.includeLoglevel = (this.template.level !== false);
    if (!this.includeTime) delete this.template.time;
    if (!this.includeLoglevel) delete this.template.level;
}
JsonFilter.create = function create( template, opts ) {
    var options = copyObject({}, opts);
    options.template = template;
    var jsonFilter = new JsonFilter(options);
    return function(message, loglevel) { return jsonFilter.filter(message, loglevel) };
}

//               0=panic  1     2   3=err 4=warn  5  6=info 7=dbg 8=trac  9
var pinoLevels = ['60', '60', '60', '50', '40', '40', '30', '20', '10', '0'];
function PinoFilter( preset ) {
    var preformatted = JSON.stringify(preset || {}).slice(1, -1) + ',';
    this.filter = function(message, loglevel) {
        var timestamp = timestamps.formatRawTimestamp();
        var msg = message && typeof message === 'object'
            ? JSON.stringify(message).slice(1, -1) : '"msg":' + JSON.stringify(message);
        return '{"level":' + pinoLevels[loglevel] + ',"time":' + timestamp + ',' + preformatted + msg + '}\n';
    }
}
PinoFilter.create = function create( opts ) {
    var defaults = copyObject({ pid: process.pid, hostname: os.hostname(), name: opts.name }, opts);
    var filter = new PinoFilter(defaults);
    return function(message, level) { return filter.filter(message, level) };
}

function KubeFilter( opts ) {
    this.options = copyObject({
        type: undefined,
        encode: JSON.stringify,
        timestamp: timestamps.formatJsDateIsoString,
        level: false,
    }, typeof opts === 'string' ? { type: opts } : opts);

    this.filter = function(message, loglevel) {
        var timestamp = this.options.timestamp();
        var level = (this.options.level) ? '","level":"' + QLogger.LEVELNAMES[loglevel] : '';
        message = _tryEncode(this.options.encode, message) || '"[unserializable object]"';
        return '{"time":"' + timestamp + '","type":"' + this.options.type + level + '","message":' + message + '}\n';
    }
}
KubeFilter.create = function create( type ) {
    var kubeFilter = new KubeFilter(type);
    return function(message, level) { return kubeFilter.filter(message, level) };
}


// also allow the legacy name
JsonFilter.makeFilter = JsonFilter.create;

JsonFilter.prototype.filter = function filter( message, loglevel ) {
    var i, bundle;

    bundle = copyObject({}, this.template);

    // always include a timestamp and the log level, and error details
    if (this.includeTime) bundle.time = (message && message.time !== undefined) ? 'placeholder' : this.getTimestamp();
    if (this.includeLoglevel) bundle.level = QLogger.LEVELNAMES[loglevel] || '?';

    if (message instanceof Error) {
        bundle.message = 'Error: ' + message.message;
        bundle.error = {
            // Error is magic, none of its fields stringify: copy them out
            code: message.code,
            message: message.message,
            stack: message.stack
        };
        // also include annotations, if any
        copyObject(bundle.error, message);
    }
    else if (typeof message !== 'object') bundle.message = message;
    else copyObject(bundle, message);

    return _tryEncode(this.encode, bundle) || this.filter('[unserializable object]', loglevel);
};

function copyObject( to, from ) {
    for (var k in from) to[k] = from[k];
    return to;
}

function _tryEncode(encode, obj) { try { return encode(obj) } catch (err) {} }
