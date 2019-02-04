// filterBasic is legacy
module.exports.filterBasic = require('./lib/filter-basic.js');
module.exports.JsonFilter = require('./lib/filter-json.js');
module.exports.BasicFilter = require('./lib/filter-basic.js').BasicFilter;

var timestamps = require('./lib/timestamps');
module.exports.formatIsoDate = timestamps.formatIsoDate;
module.exports.formatIsoDateUtc = timestamps.formatIsoDateUtc;
module.exports.formatNumericDateUtc = timestamps.formatNumericDateUtc;
module.exports.formatJsDateIsoString = timestamps.formatJsDateIsoString;
module.exports.formatBasicDate = timestamps.formatBasicDate;

module.exports.getTimestamp = timestamps.getTimestamp;
module.exports.getTimestampAsync = timestamps.getTimestampAsync;
