/**
 * QLogger -- quick little logging library
 *
 * Copyright (C) 2014,2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * The QLogger appends lines, and does so really fast.
 * Message daisy-chaining and formatting (addFilter) and writing (addWriter)
 * are handled by external code.  A few common writers are built in.
 *
 * Note: logging to a buffering writable like Fputs is much much faster than
 * to a raw write stream.  "Much much" as in 30 x faster.
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
QLogger.LOG_ERR = 3;            // #define LOG_ERR         3       /* error conditions */
QLogger.LOG_WARNING = 4;        // #define LOG_WARNING     4       /* warning conditions */
QLogger.LOG_NOTICE = 5;         // #define LOG_NOTICE      5       /* normal but significant condition */
QLogger.LOG_INFO = 6;           // #define LOG_INFO        6       /* informational */
QLogger.LOG_DEBUG = 7;          // #define LOG_DEBUG       7       /* debug-level messages */QLogger.ERROR = 3;

// our convenience aliases
QLogger.LOG_ALL = 9;            // permit all messages
QLogger.LOG_NONE = -1;          // reject all messages
QLogger.LOG_ERROR = 3;          // js alias for err
QLogger.LOG_WARN = 4;           // aka warning

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

    ALL: 9,     all: 9,         All: 9,         9: 9,   // all messages
    NONE: -1,   none: -1,       None: -1,    '-1': -1,  LOG_NONE: -1,

    WARN: 4,    warn: 4,        Warn: 4,                LOG_WARN: 4,
    ERROR: 3,   error: 3,       Error: 3,               LOG_ERROR: 3,

};
QLogger.LEVELNAMES = [
    'emerg', 'alert', 'crit', 'error', 'warning', 'notice', 'info', 'debug', '-8-', 'all'
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
    this._relays = [];
    this._writeErrors = [];
    this._writing = 0;

    if (writerType) {
        if (typeof writerType === 'string') this.addWriter(QLogger.createWriter(writerType));
        else this.addWriter(writerType);
    }
}

/**
 * get and/or set the logging verbosity level
 * Returns the old log level, and optionally sets it to a new.
 *
 * @param       loglevel        if present, verbosity to set
 */
QLogger.prototype.loglevel = function(loglevel) {
    var currentLoglevel = this._loglevel;
    if (loglevel) {
        if (!QLogger.LOGLEVELS[loglevel]) throw new Error(loglevel + ": unrecognized loglevel");
        this._loglevel = QLogger.LOGLEVELS[loglevel];
    }
    return currentLoglevel;
};

QLogger.prototype.debug = function(msg) { this._logit(msg, QLogger.LOG_DEBUG); };
QLogger.prototype.info = function(msg) { this._logit(msg, QLogger.LOG_INFO); };
QLogger.prototype.notice = function(msg) { this._logit(msg, QLogger.LOG_NOTICE); };
QLogger.prototype.warning = function(msg) { this._logit(msg, QLogger.LOG_WARNING); };
QLogger.prototype.error = function(msg) { this._logit(msg, QLogger.LOG_ERROR); };
QLogger.prototype.crit = function(msg) { this._logit(msg, QLogger.LOG_CRIT); };
QLogger.prototype.alert = function(msg) { this._logit(msg, QLogger.LOG_ALERT); };
QLogger.prototype.emerg = function(msg) { this._logit(msg, QLogger.LOG_EMERG); };

// log() method for general-purpose message writing
QLogger.prototype.log = function(msg) {
    if (arguments.length > 1) {
        var i, args = new Array(arguments.length);
        for (i=0; i<arguments.length; i++) args[i] = arguments[i];
        msg = args;
    }
    this._logit(msg, this._loglevel);
};

// alias error(), which is called err() in unix syslog
QLogger.prototype.err = QLogger.prototype.error;
// courtesy alias for warning()
QLogger.prototype.warn = QLogger.prototype.warning;

QLogger.prototype.addWriter = function(writer) { this._writers.push(writer); return this; };
QLogger.prototype.addFilter = function(filter) { this._filters.push(filter); return this; };
QLogger.prototype.addRelay = function(relay) { this._relays.push(relay); return this; };

QLogger.prototype.reportError = function(err) { this._writeErrors.push(err); /* TODO: throw? */ };

/**
 * The actual logging function that error(), info(), etc vector to.
 */
QLogger.prototype._logit = function _logit( msg, loglevel ) {
    var i, j;

    // the _relays get the unfiltered string
    // TODO: change this depth-first logging to in-order
    for (i=0; i<this._relays.length; i++) {
        this._relays[i](msg, loglevel);
    }

    if (loglevel <= this._loglevel) {
        var str = msg;

        // transform the string by applying each filter in turn
        for (i=0; i<this._filters.length; i++) {
            msg = this._filters[i](msg, loglevel);
        }

        // if the filters made the message disappear, do not log it
        // TODO: skip blank lines or log them like console.log()?
        if (!msg) return;

        // all lines must be newline terminated
        if (msg.length && msg[msg.length - 1] !== "\n") msg += "\n";

        var self = this;
        // launch the writes without waiting for them; use sync() to ensure completion
        for (i=0; i<this._writers.length; i++) {
            this._writing += 1;
            var written = this._writers[i].write(msg, function(err) {
                self._writing -= 1;
                if (err) self.reportError(err);
            });
        }
    }
};

/**
 * Flush the buffered data and invoke the callback when finished writing.
 * Sync() pushes data only to the next stream pipeline stage,
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
        if (!self._writers[i].fflush) continue;
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

            // node v0.8 did not have stream.Writable
            if (stream.Writable && writer instanceof stream.Writable) {
                var state = writer._writableState;
                if (!state) { self.reportError(new Error("cannot find _writableState on write stream")); break; }
                if (state.needDrain || state.writing) { busy = true; break; }
            }
            else if (writer instanceof net.Socket) {
                if (writer.bufferSize > 0) { busy = true; break; }
            }
            else {
                // console.log("OTHER WRITER", typeof writer);
            }
        }
        if (!busy || self._writeErrors.length > 0) {
            var errors = self._writeErrors;
            self._writeErrors = [];
            if (errors.length === 1) return callback(errors[0]);
            else return callback(errors.length > 0 ? errors : null);
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
            socket = net.connect({host: hostport[0], port: hostport[1]});
            return (!socket)
                ? callbackOrReturn(new Error(writerSpec + ": unable to connect to tcp endpoint"))
                : callbackOrReturn(false, socket);
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
