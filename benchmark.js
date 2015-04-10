/*
 * To run the benchmark:
 *
 * $ cd node_modules/qlogger
 * $ node test/benchmark.js
 * $ rm -f test.log
 */

logfileName = '/tmp/test.log';          // also try /dev/shm/test.log
useFilter = true;                       // 400k/s filtered, 650k/s raw
removeLogfile = true;                   // set to false to look at logfile contents


fs = require('fs');

QLogger = require('./index');

log = new QLogger('info', 'file://' + logfileName);
if (useFilter) log.addFilter(require('./filters').filterBasic);

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


