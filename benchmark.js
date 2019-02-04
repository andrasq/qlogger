/*
 * To run the benchmark:
 *
 * $ cd node_modules/qlogger
 * $ node ./benchmark.js
 * $ rm -f /tmp/test.log
 */

logfileName = '/tmp/test.log';          // also try /dev/shm/test.log
useFilter = true;                       // 400k/s filtered, 650k/s raw; v1.4.0 i7 SKL: 700k/s filtered, 1100k/s raw
removeLogfile = true;                   // set to false to look at logfile contents


fs = require('fs');

QLogger = require('./index');

log = new QLogger('info', 'file://' + logfileName);
if (useFilter) log.addFilter(require('./filters').filterBasic);
//if (useFilter) log.addFilter(require('./filters').JsonFilter.create());

message = new Array(199).join("x") + "\n";

setImmediate = global.setImmediate || process.nextTick;

t1 = Date.now();
nlines = 100000;
(function loop() {
    if (nlines-- > 0) log.info(message);
    if (nlines-- > 0) log.info(message);
    if (nlines > 0) setImmediate(loop);
    else {
        log.fflush(function(){
            console.log("100k lines in", Date.now() - t1, "ms");
            if (removeLogfile) fs.unlinkSync(logfileName);
        });
    }
})();
