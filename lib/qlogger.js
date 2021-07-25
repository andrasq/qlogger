/**
 * QLogger -- quick little logging library
 *
 * Copyright (C) 2014-2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * The QLogger appends lines, and does so really fast.
 * Message daisy-chaining and formatting (addFilter) and writing (addWriter)
 * are handled by external code.  A few common writers are built in.
 *
 * 2014-09-14 - AR.
 *
 */

'use strict';

var net = require('net');
var stream = require('stream');

var Fputs = require('qfputs');

// log levels like in syslog(2), plus the all-inclusive ALL
QLogger.LOG_EMERG = 0;          // #define LOG_EMERG       0       /* system is unusable */
QLogger.LOG_ALERT = 1;          // #define LOG_ALERT       1       /* action must be taken immediately */
QLogger.LOG_CRIT = 2;           // #define LOG_CRIT        2       /* critical conditions */
QLogger.LOG_ERR = 3;            // #define LOG_ERR         3       /* error conditions aka ERROR */
QLogger.LOG_WARNING = 4;        // #define LOG_WARNING     4       /* warning conditions aka WARN */
QLogger.LOG_NOTICE = 5;         // #define LOG_NOTICE      5       /* normal but significant condition */
QLogger.LOG_INFO = 6;           // #define LOG_INFO        6       /* informational */
QLogger.LOG_DEBUG = 7;          // #define LOG_DEBUG       7       /* debug-level messages */QLogger.ERROR = 3;

// syslog synonyms
QLogger.LOG_PANIC = 0;          // old syslog name for EMERG
QLogger.LOG_ERROR = 3;          // old syslog name for ERR, also nodejs
QLogger.LOG_WARN = 4;           // old syslog name for WARNING, also nodejs

// our convenience aliases
QLogger.LOG_ALL = 9;            // permit all messages
QLogger.LOG_NONE = -1;          // suppress all messages
QLogger.LOG_FATAL = 1;          // nodejs
QLogger.LOG_TRACE = 8;          // nodejs

// recognized loglevel specifiers
QLogger.LOGLEVELS = {
    EMERG: 0,   emerg: 0,       Emerg: 0,       0: 0,   LOG_EMERG: 0,
    ALERT: 1,   alert: 1,       Alert: 1,       1: 1,   LOG_ALERT: 1,
    CRIT: 2,    crit: 2,        Crit: 2,        2: 2,   LOG_CRIT: 2,
    ERR: 3,     err: 3,         Err: 3,         3: 3,   LOG_ERR: 3,
    WARNING: 4, warning: 4,     Warning: 4,     4: 4,   LOG_WARNING: 4,
    NOTICE: 5,  notice: 5,      Notice: 5,      5: 5,   LOG_NOTICE: 5,
    INFO: 6,    info: 6,        Info: 6,        6: 6,   LOG_INFO: 6,
    DEBUG: 7,   debug: 7,       Debug: 7,       7: 7,   LOG_DEBUG: 7,

    // nodejs
    FATAL: 1,   fatal: 1,       Fatal: 1,               LOG_FATAL: 1,
    TRACE: 8,   trace: 8,       Trace: 8,       8: 8,   LOG_TRACE: 8,

    ALL: 9,     all: 9,         All: 9,         9: 9,   // all messages
    NONE: -1,   none: -1,       None: -1,    '-1': -1,  LOG_NONE: -1,

    // syslog synonyms
    WARN: 4,    warn: 4,        Warn: 4,                LOG_WARN: 4,
    ERROR: 3,   error: 3,       Error: 3,               LOG_ERROR: 3,
    PANIC: 0,   panic: 0,       Panic: 0,               LOG_PANIC: 0,

};
QLogger.LEVELNAMES = [
    //    0        1       2        3          4         5       6        7             9
    'emerg', 'alert', 'crit', 'error', 'warning', 'notice', 'info', 'debug', 'trace', 'all',
];

/**
 * QLogger class, first writer is optional, no formatters included.
 * Any object with a write(str, cb) method can be used as a writer.
 * Writers can also be created with QLogger.createWriter().
 *
 * @param       loglevel        verbosity, eg 'error' or 'info' or 'debug'
 * @param       writerType      optional writer constructor params, as for createWriter
 */
function QLogger( loglevel, writerType ) {
    if (!(this instanceof QLogger)) return new QLogger(loglevel, writerType);

    this.loglevel(loglevel ? loglevel : 'info');

    this._writers = [];
    this._filters = [];
    // this._relays = [];       // maybe later
    this._writeErrors = [];
    this._writing = 0;

    if (writerType) {
        if (typeof writerType === 'string') this.addWriter(QLogger.createWriter(writerType));
        else this.addWriter(writerType);
    }

    var self = this;
    this._doneWrite = function(err) {
        self._writing -= 1;
        if (err) self.reportError(err);
    }
}

/**
 * get and/or set the logging verbosity level
 * Returns the old log level, and optionally sets it to a new.
 *
 * @param       loglevel        if present, verbosity to set
 */
QLogger.prototype.loglevel = function( loglevel ) {
    var currentLoglevel = this._loglevel;
    if (loglevel) {
        if (!QLogger.LOGLEVELS[loglevel]) throw new Error(loglevel + ": unrecognized loglevel");
        this._loglevel = QLogger.LOGLEVELS[loglevel];
    }
    return currentLoglevel;
};

function defineLogMethods( proto, makeLogMethod ) {
    // syslog(2) log levels
    proto.trace = makeLogMethod(QLogger.LOG_TRACE); // nodejs
    proto.debug = makeLogMethod(QLogger.LOG_DEBUG);
    proto.info = makeLogMethod(QLogger.LOG_INFO);
    proto.notice = makeLogMethod(QLogger.LOG_NOTICE);
    proto.warning = makeLogMethod(QLogger.LOG_WARNING);
    proto.err = makeLogMethod(QLogger.LOG_ERROR);
    proto.crit = makeLogMethod(QLogger.LOG_CRIT);
    proto.alert = makeLogMethod(QLogger.LOG_ALERT);
    proto.emerg = makeLogMethod(QLogger.LOG_EMERG);

    // nodejs aliases
    proto.error = proto.err;
    proto.warn = proto.warning;
    proto.panic = proto.emerg;
}
defineLogMethods(QLogger.prototype, function(level) { return function(msg) { this._logit(msg, level) } });

// log() method for general-purpose message writing
QLogger.prototype.log = function log( msg /* ,VARARGS */ ) {
    if (arguments.length > 1) {
        var i, args = new Array(arguments.length);
        for (i=0; i<arguments.length; i++) args[i] = arguments[i];
        msg = args;
    }
    this._logit(msg, this._loglevel);
};

/**
 * Define a function to combine multiple arguments into a single logline.
 * Without a serializer the log methods only log their first argument.
 */
// invoke1 from qibl:
var invoke1 = eval("parseInt(process.versions.node) < 6 ? _invoke1 : eval('1 && function(func, argv) { return func(...argv) }')");
QLogger.prototype.setSerializer = function setSerializer( combineArgs ) {
    var self = this;
    function buildArgCombiner(level) {
        return function() {
            if (arguments.length === 1) self._logit(combineArgs(arguments[0]), level);
            else if (arguments.length === 2) self._logit(combineArgs(arguments[0], arguments[1]), level);
            else {
                var args = []; for (var i=0; i<arguments.length; i++) args.push(arguments[i]);
                self._logit(invoke1(combineArgs, args), level);
            }
        }
    }
    defineLogMethods(this, buildArgCombiner);
    return this;
}
// _invoke1 from qibl:
/* istanbul ignore next */
function _invoke1( func, argv ) {
    switch (argv.length) {
    case 0: return func();
    case 1: return func(argv[0]);
    case 2: return func(argv[0], argv[1]);
    case 3: return func(argv[0], argv[1], argv[2]);
    default: return func.apply(null, argv);
    }
}

QLogger.prototype.addWriter = function(writer) { this._writers.push(writer); return this; };
QLogger.prototype.addFilter = function(filter) { this._filters.push(filter); return this; };
// QLogger.prototype.addRelay = function(relay) { this._relays.push(relay); return this; };     // maybe later

QLogger.prototype.getWriters = function() { return this._writers };
QLogger.prototype.removeWriter = function(writer) { var ix = this._writers.indexOf(writer); if (ix >= 0) this._writers.splice(ix, 1) };
QLogger.prototype.getFilters = function() { return this._filters };
QLogger.prototype.removeFilter = function(filter) { var ix = this._filters.indexOf(filter); if (ix >= 0) this._filters.splice(ix, 1) };
// QLogger.prototype.getRelays = function() { return this._relays };
// QLogger.prototype.removeRelay = function(relay) { var ix = this._relays.indexOf(relay); if (ix >= 0) this._relays.splice(ix, 1) };

// save errors to report to fflush
QLogger.prototype.reportError = function(err) { this._writeErrors.push(err); /* TODO: emit? */ };

/**
 * The actual logging function that error(), info(), etc vector to.
 */
QLogger.prototype._logit = function _logit( msg, loglevel ) {
    var i, j;
    var self = this;

    // maybe later: the _relays get the unfiltered string
    // for (i=0; i<this._relays.length; i++) {
    //     this._relays[i](msg, loglevel);
    // }

    if (loglevel <= this._loglevel) {
        var str = msg;

        // transform the string by applying each filter in turn
        for (i=0; i<this._filters.length; i++) {
            msg = this._filters[i](msg, loglevel);
            if (msg === undefined) break;
        }

        // if the filters made the message disappear, do not log it
        // TODO: skip blank lines or write a newline like console.log()?
        if (!msg) return;

        // if the filters did not convert the message, cast to string
        // This also works around buggy log() usage where the filters do not combine args.
        if (typeof msg !== 'string') msg = String(msg);

        // all lines must be newline terminated
        if (msg.length && msg.charCodeAt(msg.length - 1) !== 10) msg += "\n";

        // launch the writes without waiting for them; use sync() to ensure completion
        var writers = this._writers;
        for (i=0; i<writers.length; i++) {
            this._writing += 1;
            writers[i].write(msg, self._doneWrite);
        }
    }
};

/**
 * Flush the buffered data and invoke the callback when finished writing.
 * Note: pushes data only to the next stream pipeline stage,
 * not all the way to durable store.
 */
// FIXME: newly arrived data will delay this finishing
// TODO: report _writeErrors via the callback
QLogger.prototype.fflush = function fflush( callback ) {
    var i;
    var writer;

    // start an fflush() on all writers that support it (eg fputs)
    var nsyncs = 0;
    var self = this;
    for (i=0; i<this._writers.length; i++) {
        if (typeof self._writers[i].fflush !== 'function') continue;
        try {
            nsyncs += 1;
            self._writers[i].fflush(function (err, ret) {
                nsyncs -= 1;
                if (err) return self.reportError(err);
            });
        }
        catch (err) { nsyncs -= 1; }
    }

    // wait for each writer to finish writing
    (function waitWhileBusy(self) {
        var busy = (self._writing || nsyncs > 0);
        if (!busy) for (i=0; i<self._writers.length; i++) {
            writer = self._writers[i];

            // since node v6 sockets are also stream.Writable, test socket first, then also Writable
            // node v0.10 to v5 sockets had _writableState but were not instanceof
            if (writer instanceof net.Socket) {
                if (writer.bufferSize > 0) { busy = true; break; }
            }
            // node v0.8 did not have stream.Writable
            if (stream.Writable && (writer instanceof stream.Writable || writer instanceof net.Socket)) {
                var state = writer._writableState;
                if (state && (state.needDrain || state.writing)) { busy = true; break; }
            }
            else {
                // console.log("OTHER WRITER", typeof writer);
            }
        }
        if (!busy || self._writeErrors.length > 0) {
            var errors = self._writeErrors;
            self._writeErrors = [];
            if (errors.length === 1) return process.nextTick(function() { callback(errors[0]) });
            else process.nextTick(function() { callback(errors.length > 0 ? errors : null) });
        }
        else setTimeout(function(){ waitWhileBusy(self) }, 1);
    })(this);
};
QLogger.prototype.sync = QLogger.prototype.fflush;


/**
 * Create a log writer for use with QLogger.
 * This simple built-in handles files, stdout, stderr, TCP and UDP sockets.
 * Other writers, eg syslog(), must be created externally.
 *
 * The writer to create is encoded as
 *      file:///path/to/file    absolute filename /path/to/file
 *      file://file/name        relative filename file/name
 *      file://-                alias for stdout://, process.stdout
 *      stdout://               process.stdout
 *      stderr://               process.stderr
 *      tcp://host:port
 *      udp://host:port
 *
 * @param       writerSpec      type of writer to create
 */
QLogger.createWriter = function createWriter( writerSpec, callback ) {
    // callback is optional, all writers are created synchronously
    function callbackOrReturn(err, value) {
        if (callback) callback(err, value);
        else if (err) throw err;
        else return value;
    }

    var typename = writerSpec.split("://");
    var type = typename[0];
    var name = typename[1];
    try {
        var hostport, socket;
        switch (type) {
        case 'null':
            return callbackOrReturn(null, {write: function(str, cb) { cb(); }});
        case 'file':
            if (name === '-') return callbackOrReturn(null, process.stdout);
            return callbackOrReturn(null, new Fputs(new Fputs.FileWriter(name, 'a')));
        case 'stdout':
            return callbackOrReturn(null, process.stdout);
        case 'stderr':
            return callbackOrReturn(null, process.stderr);
        case 'tcp':
            hostport = name.split(":");
            socket = net.connect({host: hostport[0], port: hostport[1]}, function() { callbackOrReturn(null, socket) });
            socket.on('error', function(err) { callbackOrReturn(err) });
            return socket;
        case 'udp':
            var dgram = require('dgram');
            hostport = name.split(":");
            // TODO: missing udp6 support
            socket = dgram.createSocket('udp4');
            // datagram sockets do not have a write() method, so provide one
            socket.write = function(msg, cb) {
                var buf = new Buffer(msg);
                // max UDP packet length = (2^16 - 1) - 20 ip header - 8 udp header = 65507
                if (buf.length > 65507) {
                    process.stderr.write("log line longer than max UDP message size\n");
                    return cb(new Error("log line longer than max UDP message size"));
                }
                socket.send(buf, 0, buf.length, hostport[1], hostport[0], cb);
            }
            return callbackOrReturn(false, socket);
        default:
            throw new Error(writerSpec + ": unrecognized log writer spec");
        }
    }
    catch (err) {
        return callbackOrReturn(err);
    }
}

// speed up access
QLogger.prototype = toStruct(QLogger.prototype);
function toStruct(hash) { return eval("toStruct.prototype = hash") }


module.exports = QLogger;
