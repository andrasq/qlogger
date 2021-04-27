/**
 * timestamp formatters
 *
 * Copyright (C) 2014-2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var setImmediate = global.setImmediate || process.nextTick;
var timebase = new Timebase();

module.exports = {
    formatIsoDate: formatIsoDate,
    formatIsoDateUtc: formatIsoDateUtc,
    formatNumericDateUtc: formatNumericDateUtc,
    formatJsDateIsoString: formatJsDateIsoString,
    formatBasicDate: formatBasicDate,
    formatRawTimestamp: formatRawTimestamp,
    formatJsonDate: formatJsonDate,

    getTimestamp: function() { return timebase.getTimestamp() },
    getTimestampAsync: function(cb) { return timebase.getTimestampAsync(cb) },

    pad2: pad2,
    pad3: pad3,
    pad4: pad4,

    test: {
        Timebase: Timebase,
    },
}

// format MySQL-type ISO "2014-10-19 01:23:45"
var sqlFormatter = new DateFormatterSeconds(
    function(ms) {
        var dt = new Date(ms); return '' + dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" + pad2(ms / 1000 % 60 >> 0) },
    function(ms) {
        return this.getFormattedSeconds(ms) }
);
function formatIsoDate( millisec ) { return sqlFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// as above, but as UTC
var sqlFormatterUtc = new DateFormatterSeconds(
    function formatMinutes(ms) { var dt = new Date(ms); return '' +
        dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate()) + " " +
        pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes()) + ":" + pad2(ms / 1000 % 60 >> 0) },
    function format(ms) {
        return this.getFormattedSeconds(ms) }
);
function formatIsoDateUtc( millisec ) { return sqlFormatterUtc.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// sqlFormatter for filter-basic, but with milliseconds included  "2019-02-01 12:34:56.789"
var basicFormatter = new DateFormatterSeconds(
    function(ms) { var dt = new Date(ms); return '' +
        dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" + pad2(ms / 1000 % 60 >> 0) + '.' },
    function(ms) {
        return this.getFormattedSeconds(ms) + pad3(ms % 1000) }
);
function formatBasicDate(ms) { return basicFormatter.format(ms > -Infinity ? ms : timebase.getTimestamp()) }

// format as purenly numeric, 20190201021637.368
var numFormatter = new DateFormatterSeconds(
    function formatMinutes(ms) { var dt = new Date(ms);
        return '' + dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate()) +
        pad2(dt.getUTCHours()) + pad2(dt.getUTCMinutes()) + pad2(dt.getUTCSeconds()) + '.' },
    function format(ms) {
        return this.getFormattedSeconds(ms) + pad3(ms % 1000) }
);
function formatNumericDateUtc( millisec ) { return numFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// raw numeric timestamps expressed as milliseconds since the epoch
var rawFormatter = new DateFormatterSeconds(
    function(ms) { return String(ms / 1000 >> 0) },
    function(ms) { return this.getFormattedSeconds(ms) + pad3(ms % 1000) }
);
function formatRawTimestamp( ms ) { return rawFormatter.format(ms || timebase.getTimestamp()) }

// format as new Date().toISOString() "2019-02-01T02:16:37.368Z", but faster
var jsonFormatter = new DateFormatterSeconds(
    function(ms) { return new Date(ms).toJSON().slice(0, -4) },
    function(ms) { return this.getFormattedSeconds(ms) + pad3(ms % 1000) + 'Z' }
);
function formatJsonDate( ms ) { return jsonFormatter.format(ms || timebase.getTimestamp()) }
function formatJsDateIsoString( millisec ) { return jsonFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

function pad2( number ) { return number >= 10 ? number : "0" + number }
function pad3( number ) { return number >= 100 ? number : "0" + pad2(number) }
function pad4( number ) { return number >= 1000 ? number : "0" + pad3(number) }

function DateFormatterSeconds( formatSeconds, format ) {
    this.savedSeconds = NaN,
    this.savedSecondsString = '',
    this.format = format;
    this.getFormattedSeconds = function getFormattedSeconds(ms) {
        var sec = ms - ms % 1000;
        if (sec === this.savedSeconds) return this.savedSecondsString;
        this.savedSeconds = sec;
        return this.savedSecondsString = formatSeconds(sec);
    }
}

// fast source for current-date millisecond timestamps
// Reuse an existing cached timestamp if still fresh,
// or generate a new timestamp and invalidate it when it changes.
function Timebase( ) {
    var self = this;
    this.timestamp = 0;
    this.timeoutTimer = null;

    this.getTimestamp = function getTimestamp() {
        return (this.reuseLimit-- > 0 && this.timestamp) ? this.timestamp : (this.refresh(), this.timestamp);
    }
    this.getTimestampAsync = function getTimestampAsync(cb) {
        // get a timestamp guaranteed to be current.  Using setImmediate ensures that
        // the timeoutTimer has a chance to discard a stale timestamp before we return it.
        // Note that setTimeout is itself imprecise, the ms may have itself ticked
        // with the timeout still pending; test for +/- 1 ms.
        var self = this;
        setImmediate(function() { cb(null, self.getTimestamp()) });
    }
    this.refresh = function refresh() {
        self.timeoutTimer = self.timeoutTimer || setTimeout(self.reset);
        self.reuseLimit = 50;
        self.timestamp = Date.now();
    }
    this.reset = function reset() {
        self.timeoutTimer = null;
        self.timestamp = 0;
    }
}
