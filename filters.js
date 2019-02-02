// filterBasic is legacy
module.exports.filterBasic = require('./lib/filter-basic.js');
module.exports.JsonFilter = require('./lib/filter-json.js');
module.exports.BasicFilter = require('./lib/filter-basic.js').BasicFilter;

var formatTimestamp = require('./lib/format-timestamp');
module.exports.formatIsoDate = formatTimestamp.formatIsoDate;
module.exports.formatIsoDateUtc = formatTimestamp.formatIsoDateUtc;
module.exports.formatNumericDateUtc = formatTimestamp.formatNumericDateUtc;
module.exports.formatJsDateIsoString = formatTimestamp.formatJsDateIsoString;
module.exports.formatBasicDate = formatTimestamp.formatBasicDate;
