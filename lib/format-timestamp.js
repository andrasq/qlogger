/**
 * timestamp formatters
 *
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

module.exports.formatIsoDate = formatIsoDate;
module.exports.formatIsoDateUtc = formatIsoDateUtc;
module.exports.pad2 = pad2;
module.exports.pad3 = pad3;
module.exports.pad4 = pad4;

// format MySQL-type ISO "2014-10-19 01:23:45"
function formatIsoDate( millisec ) {
    var dt = new Date(millisec);
    var datetime =
        dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()) + " " +
        pad2(dt.getHours()) + ":" + pad2(dt.getMinutes()) + ":" + pad2(dt.getSeconds());
    return datetime;
}

// as above, but as UTC
function formatIsoDateUtc( millisec ) {
    var dt = new Date(millisec);
    var datetime =
        dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate()) + " " +
        pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes()) + ":" + pad2(dt.getUTCSeconds());
    return datetime;
}

function pad2( number ) {
    return number >= 10 ? number : "0" + number;
}

function pad3( number ) {
    return number >= 100 ? number : "0" + pad2(number);
}

function pad4( number ) {
    return number >= 1000 ? number : "0" + pad3(number);
}
