// filterBasic is legacy
module.exports.filterBasic = require('./lib/filter-basic.js');
module.exports.JsonFilter = require('./lib/filter-json.js');
module.exports.BasicFilter = require('./lib/filter-basic.js').BasicFilter;

module.exports.formatIsoDate = require('./lib/format-timestamp.js').formatIsoDate;
module.exports.formatIsoDateUtc = require('./lib/format-timestamp.js').formatIsoDateUtc;
module.exports.formatNumericDateUtc = require('./lib/format-timestamp.js').formatNumericDateUtc;
