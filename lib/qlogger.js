/**
 * QLogger -- quick little logging library
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
/*jshint lastsemic: true */

'use strict';

var fs = require('fs');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var stream = require('stream');

// log levels like in syslog(2), plus the all-inclusive ALL
// only the 3 core log levels are supported of the 8 unix syslog ones
QLogger.ERROR = 3;
QLogger.INFO = 6;
QLogger.DEBUG = 7;
QLogger.ALL = 9;

// recognized loglevel specifiers
QLogger.LOGLEVELS = {
    ALL: 9,     all: 9,         All: 9,         9: 9,
    DEBUG: 7,   debug: 7,       Debug: 7,       7: 7,
    INFO: 6,    info: 6,        Info: 6,        6: 6,
    ERR: 3,     err: 3,         Err: 3,
    ERROR: 3,   error: 3,       Error: 3,       3: 3,
};

/**
 * QLogger class, first writer is optional, no formatters included.
 * Any object with a write(str, cb) method can be used as a writer.
 * Writers can also be created with QLogger.createWriter().
 *
 * @param       loglevel        verbosity, eg 'error' or 'info' or 'debug'
 * @param       writerType      optional writer constructor params, as for createWriter
 */
function QLogger( loglevel, writerType ) {
    if (!this instanceof QLogger) return new QLogger(loglevel, writerType);

    if (!QLogger.LOGLEVELS[loglevel]) throw new Error(loglevel + ": unrecognized loglevel");
    this.loglevel = QLogger.LOGLEVELS[loglevel];

    this._writers = [];
    this._filters = [];
    this._relays = [];
    this._writeErrors = [];
    this._writing = 0;

    if (writerType) {
        if (typeof writerType === 'string') this.addWriter(QLogger.createWriter(writerType));
        else this.addWriter(writerType);
    }
    else this.addWriter(QLogger.createWriter('null://'));
}

QLogger.prototype.debug = function(msg) { this._logit(msg, QLogger.DEBUG); };
QLogger.prototype.info = function(msg) { this._logit(msg, QLogger.INFO); };
QLogger.prototype.error = function(msg) { this._logit(msg, QLogger.ERROR); };

// syslog alias for error(), which is called err() in unix
QLogger.prototype.err = QLogger.prototype.error;

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
    for (i in this._relays) {
        this._relays[i](msg, loglevel);
    }

    if (loglevel <= this.loglevel) {
        var str = msg;

        // transform the string by applying each filter in turn
        for (i in this._filters) msg = this._filters[i](msg, loglevel);

        // all lines must be newline terminated
        if (msg.length && msg[msg.length - 1] !== "\n") msg += "\n";

        var self = this;
        // launch the writes without waiting for them; use sync() to ensure completion
        for (i in this._writers) {
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
// FIXME: rename fflush
// TODO: report _writeErrors via the callback
QLogger.prototype.sync = function sync( callback ) {
    var i;
    var writer;

    // start a sync() on all writers that support it (eg fputs)
    var nsyncs = 0;
    var sync;
    var self = this;
    for (i in this._writers) {
        try {
            nsyncs += 1;
            self._writers[i].sync(function (err, ret) {
                nsyncs -= 1;
                if (err) return self.reportError(err);
            });
        }
        catch (err) { nsyncs -= 1; }
    }

    // wait for each writer to finish writing
    (function waitWhileBusy(self) {
        var busy = (self._writing || nsyncs > 0);
        if (!busy) for (i in self._writers) {
            writer = self._writers[i];

            if (writer instanceof stream.Writable) {
                var state = writer._writableState;
                if (state.needDrain || state.writing) { busy = true; break; }
            }
            else if (writer instanceof net.Socket) {
                if (writer.bufferSize > 0) { busy = true; break; }
            }
            else {
                // console.log("OTHER WRITER", typeof writer);
            }
        }
        if (!busy) return callback();
        else setTimeout(function(){ waitWhileBusy(self) }, 2);
    })(this);
};


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
        return value;
    }

    var typename = writerSpec.split("://");
    var type = typename[0];
    var name = typename[1];
    try {
        switch (type) {
        case 'null':
            return callbackOrReturn(null, {write: function(str, cb) { cb(); }});
            break;
        case 'file':
            if (name === '-') return callbackOrReturn(null, process.stdout);
            var Fputs = require('qfputs');
            return callbackOrReturn(null, new Fputs(new Fputs.WriteWriter(name, 'a')));
            break;
        case 'stdout':
            return callbackOrReturn(null, process.stdout);
            break;
        case 'stderr':
            return callbackOrReturn(null, process.stderr);
            break;
        case 'tcp':
            var hostport = name.split(":");
            var socket = net.connect({host: hostport[0], port: hostport[1]});
            if (!socket)
                return callbackOrReturn(new Error(writerSpec + ": unable to connect to tcp endpoint"));
            return
                return callbackOrReturn(socket);
            break;
        case 'udp':
            var dgram = require('dgram');
            var hostport = name.split(":");
            // TODO: missing udp6 support
            var sock = dgram.createSocket('udp4');
            // datagram sockets do not have a write() method, so provide one
            sock.write = function(msg, cb) {
                var buf = new Buffer(msg);
                // max UDP packet length = (2^16 - 1) - 20 ip header - 8 udp header = 65507
                if (buf.length > 65507) {
                    process.stderr.write("log line longer than max UDP message size\n");
                    return cb(new Error("log line longer than max UDP message size"));
                }
                sock.send(buf, 0, buf.length, hostport[1], hostport[0], cb);
            }
            return callbackOrReturn(sock);
            break;
        default:
            throw new Error(writerSpec + ": unrecognized log writer spec");
            break;
        }
    }
    catch (err) {
        return callbackOrReturn(err);
    }
}

module.exports = QLogger;
