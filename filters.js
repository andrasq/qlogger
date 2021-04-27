/**
 * basic logging filters
 *
 * Copyright (C) 2014-2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2014-10-29 - AR.
 */

var QLogger = require('./lib/qlogger');
var timestamps = require('./lib/timestamps');

// basic logging filter, adds a timestamp and the loglevel
// This tiny filter was moved here from lib/filter-basic.
function BasicFilter( ) {
    this.filter = function filter(message, loglevel) {
        var timestring = timestamps.formatBasicDate();
        // var timestring = timestamps.formatJsonDate();
        return timestring + " [" + QLogger.LEVELNAMES[loglevel] + "] " + message;
    }
}
BasicFilter.create = function create( ) {
    var filter = new BasicFilter();
    return function(message, level) { return filter.filter(message, level) }
}

module.exports.JsonFilter = require('./lib/filter-json');
module.exports.KubeFilter = require('./lib/filter-json').KubeFilter;
module.exports.PinoFilter = require('./lib/filter-json').PinoFilter;
module.exports.BasicFilter = BasicFilter;
// filterBasic is legacy
module.exports.filterBasic = module.exports.BasicFilter.create();

var timestamps = require('./lib/timestamps');
module.exports.formatIsoDate = timestamps.formatIsoDate;
module.exports.formatIsoDateUtc = timestamps.formatIsoDateUtc;
module.exports.formatNumericDateUtc = timestamps.formatNumericDateUtc;
module.exports.formatJsDateIsoString = timestamps.formatJsDateIsoString;
module.exports.formatBasicDate = timestamps.formatBasicDate;
module.exports.formatRawTimestamp = timestamps.formatRawTimestamp;
module.exports.formatJsonDate = timestamps.formatJsonDate;

module.exports.getTimestamp = timestamps.getTimestamp;
module.exports.getTimestampAsync = timestamps.getTimestampAsync;
