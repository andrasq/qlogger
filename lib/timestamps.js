/**
 * timestamp formatters
 *
 * Copyright (C) 2014-2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var timebase = new Timebase();

module.exports = {
    formatIsoDate: formatIsoDate,
    formatIsoDateUtc: formatIsoDateUtc,
    formatNumericDateUtc: formatNumericDateUtc,
    formatJsDateIsoString: formatJsDateIsoString,
    formatBasicDate: formatBasicDate,

    getTimestamp: function() { return timebase.getTimestamp() },
    getTimestampAsync: function(cb) { return timebase.getTimestampAsync(cb) },

    pad2: pad2,
    pad3: pad3,
    pad4: pad4,

    test: {
        DateFormatter: DateFormatter,
        Timebase: Timebase,
    },
}

// format MySQL-type ISO "2014-10-19 01:23:45"
var sqlFormatter = new DateFormatter(
    function formatMinutes(ms) {
        var dt = new Date(ms); return '' + dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" },
    function format(ms) {
        return this.getFormattedMinutes(ms) + pad2(ms / 1000 % 60 >> 0) }
);
function formatIsoDate( millisec ) { return sqlFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// as above, but as UTC
var sqlFormatterUtc = new DateFormatter(
    function formatMinutes(ms) { var dt = new Date(ms); return '' +
        dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate()) + " " +
        pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes()) + ":" },
    function format(ms) {
        return this.getFormattedMinutes(ms) + pad2(ms / 1000 % 60 >> 0) }
);
function formatIsoDateUtc( millisec ) { return sqlFormatterUtc.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// sqlFormatter for filter-basic, but with milliseconds included
var basicFormatter = new DateFormatter(
    function formatMinutes(ms) { var dt = new Date(ms); return '' +
        dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" },
    function format(ms) {
        return this.getFormattedMinutes(ms) + pad2(ms / 1000 % 60 >> 0) + '.' + pad3(ms % 1000) }
);
function formatBasicDate( millisec ) { return basicFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// format as purely numberic, 20190201021637.368
var numFormatter = new DateFormatter(
    function formatMinutes(ms) { var dt = new Date(ms); return '' +
        dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate()) + pad2(dt.getUTCHours()) + pad2(dt.getUTCMinutes()) },
    function format(ms) {
        return this.getFormattedMinutes(ms) + pad2(ms / 1000 % 60 >> 0) + '.' + pad3(ms % 1000) }
);
function formatNumericDateUtc( millisec ) { return numFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }

// format as new Date().toISOString() "2019-02-01T02:16:37.368Z", but faster
var jsFormatter = new DateFormatter();
function formatJsDateIsoString( millisec ) { return jsFormatter.format(millisec > -Infinity ? millisec : timebase.getTimestamp()) }


function pad2( number ) {
    return number >= 10 ? number : "0" + number;
}

function pad3( number ) {
    return number >= 100 ? number : "0" + pad2(number);
}

function pad4( number ) {
    return number >= 1000 ? number : "0" + pad3(number);
}

function DateFormatter( formatMinute, format ) {
    this.formatMinutes = formatMinute || function(ms) { return new Date(ms).toISOString().slice(0, 17) },
    this.savedMinute = NaN,
    this.savedMinuteString = '',
    this.format = format || function format(millisec) {
        return this.getFormattedMinutes(millisec) + pad2((millisec / 1000) % 60 >> 0) + '.' + pad3(millisec % 1000) + 'Z';
    },
    this.getFormattedMinutes = function getFormattedMinutes(millisec) {
        var currentMinute = millisec - millisec % 60000;
        if (currentMinute !== this.savedMinute) {
            this.savedMinute = currentMinute;
            return this.savedMinuteString = this.formatMinutes(this.savedMinute);
        }
        return this.savedMinuteString;
    }
}

// fast source for current-date millisecond timestamps
// Reuse an existing cached timestamp if still fresh,
// or generate a new timestamp and invalidate it when it changes.
function Timebase( ) {
    this.getTimestamp = function getTimestamp() {
        return (this.reuseLimit-- > 0 && this.timestamp) ? this.timestamp : this.refresh() && this.timestamp;
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
        var self = this;
        if (!self.timeoutTimer) {
            self.timeoutTimer = setTimeout(function() { self.reset() });
        }
        var now = new Date();
        self.timestamp = now.getTime();
        self.reuseLimit = 50;
        return true;
    }
    this.reset = function reset() {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = null;
        this.timestamp = null;
    }
    this.reset();
}