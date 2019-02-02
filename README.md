qlogger
=======
[![Build Status](https://travis-ci.org/andrasq/qlogger.svg?branch=master)](https://travis-ci.org/andrasq/qlogger)
[![Coverage Status](https://coveralls.io/repos/github/andrasq/qlogger/badge.svg?branch=master)](https://coveralls.io/github/andrasq/qlogger?branch=master)

quick nodejs logging and newline delimited data transport

QLogger is a toolkit for building very fast loggers.  It can be used out of
the box as-is, or it can be easily configured in new ways for custom loggers.
It's very lean, very fast, very flexible, and easy to use.

It can log in any format, eg space-separated text or json bundles.  The
formatters and writers are pluggable, use one of the defaults or use your
own.

How fast?  On my system I get 650k 200 byte lines per second saved to a shared
logfile under LOCK_EX mutex
(using [qfputs](https://www.npmjs.org/package/qfputs) as the writer and logging
only 2 lines per continuable; 1.1m per sec if logging 5 lines per continuable).

A slow logger can report on the data being processed.  A fast logger is a data
streaming engine, and can itself process data.

        const qlogger = require('qlogger');
        const filters = require('qlogger/filters');
        const logger = qlogger('info', 'file:///var/log/myApp/app.log');
        logger.addFilter(filters.BasicFilter().create());
        logger.info('Hello, world.');


Installation
------------

        npm install qlogger

Unit test:

        npm test qlogger

Speed test (log 100k timestamped 200 byte lines):

        node node_modules/qlogger/benchmark.js

Structure
---------

QLogger sends newline-delimited strings (messages) to writers.  The strings
may be edited in flight by filters.  Filters return the modified string, and
can annotate it with timestamp, loglevel, hostname, etc., or serialize objects
for export.  Writers deliver the strings to their detaination.

Writers can be added to write to file, send over TCP/IP, send to syslog, etc.
The strings can be modified in flight by filters, which will write the altered
string.  Common filters would be to add a timestap and the message loglevel.
Writers and filters must be configured explicitly, there is no default.

QLogger exports a simplified subset of the traditional logging methods:
error, info, and debug.  Each log message is appended to the logfile
as a newline terminated string.

Newline delimited text is a universally compatible, easy-to-parse and
very very fast way to stream and process data.

Points to keep in mind when using logfiles for general-purpose data transport:
  - the logfile might have multiple writers and unix writes are not atomic,
    ie writes need a mutex (write-write mutex, eg flock(LOCK_EX))
  - the logfile might be consumed by simple readers that do not tolerate
    partial writes, so each write should be a complete newline terminated
    message (ie, hold the lock for the duration of the write)
  - the reader might itself modify the logfile (eg compact it), so
    writes need a mutex (read-write mutex, eg flock(LOCK_EX))
  - the logfile might get consumed (renamed or removed), ie cannot reuse the
    file handle indefinitely, must reopen the file periodically
  - the logfile could be used for low-latency buffering, so the reopen
    interval should be pretty short (all consumers of the logfile must
    wait out the reopen interval to ensure that activity has settled
    before moving on from the file)

### Examples

Log to stdout, formatting the log lines with the basic plaintext filter:

        qlogger = require('qlogger');
        filters = require('qlogger/filters');
        logger = qlogger('info', process.stdout);
        logger.addFilter(filters.BasicFilter.create());

And then

        logger.info("Hello, world.");
        // => 2014-11-22 15:03:38.482 [info] Hello, world.
        logger.debug("debug messages not on");
        // =>
        logger.error("Hello again.");
        // => 2014-11-22 15:03:38.483 [error] Hello again.

The above, step by step:

        QLogger = require('qlogger');
        logger = new QLogger();
        logger.loglevel('info');
        logger.addWriter(process.stdout);
        BasicFilter = require('qlogger/filters').BasicFilter;
        logger.addFilter(BasicFilter.create());

Log to file using a write stream, formatting the log lines with a quick inline
function (note: this is just as an example, file write streams are too slow to
use where speed matters):

        fs = require('fs');
        QLogger = require('qlogger');
        logger = new QLogger('info', fs.createWriteStream('app.log', 'a'));
        logger.addFilter(function(msg, level) {
            return new Date().toISOString + " " + msg;
        });

Log to file using a qfputs FileWriter, without any additional formatting.
This can stream over 100MB/sec of data one line at a time to a
mutex-controlled shared logfile.

        QLogger = require('qlogger');
        logger = new QLogger('info', QLogger.createWriter('file://app.log', 'a'));

Methods
-------

### new QLogger( [loglevel], [writer] )

Create a logger that will log messages of importance loglevel or above.  It is
an error if the loglevel is not recognized.

Loglevel can be specified as a string 'error', 'info' or 'debug'.  If
omitted, it defaults to 'info'.  Internally, they are converted to the
standard unix syslog loglevels 3, 6 and 7.  The higher syslog logging
levels (emerg, alert, and crit) and warning and notice were deliberately
omitted, leaving just the three essential message classes:  human
attention required, useful statistics, and everything available for
debugging.  As of version v1.4.0, all `syslog` loglevels are recognized:
'emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info' and 'debug',
along with 'all' and 'none'.

The optional writer may be a writerObject (see addWriter below), or a writer
specification string.  The latter will create one of the built-in writers
using QLogger.createWriter().  If no writerSpec is given, the logger will be
created without a writer.  It is an error if the writer specification is not
recognized.  The built-in writers are those supported by createWriter().

### QLogger.createWriter( writerSpec )

This class method will create a new writer corresponding to the spec.
The recognized writer specifications are:

        file://</path/to/file>          // absolute filepath
        file://<file/name>              // relative filename
        stdout://                       // process.stdout
        stderr://                       // process.stderr
        tcp://<host>:<port>             // net.connect() tcp connection
        udp://<host>:<port>             // datagram

### Logging Methods

#### log( message [, ...] )

Log a multi-argument message.  The message is passed to the filters using the
current loglevel (so a logger that has loglevel 'debug' will write log()
messages as if they were from debug()).  Multiple arguments are gathered into an
array, and the filter is expected to convert them to a string.  (This last
allows `printf`-like formatted output).

#### error( message )

Log an error message.  Error messages will be logged by all loglevels,
'error', 'info' and 'debug'.

#### info( message )

Log an informational message.  The logger must have loglevel 'info' or
'debug'.

#### debug( message )

Log a debug message.  The logger must have loglevel of 'debug'.

#### fflush( callback )

Tries to force all writers to write out any buffered data.  Invokes the
callback once the writes have all finished.  This is a half-hearted
implementation, since fflush can only flush write streams, tcp sockets and
FileWriter (file://) objects.

#### loglevel( [newLoglevel] )

returns the current loglevel.  The loglevel controls the log sensitivity; a
loglevel of 'info' would write info() and error() messages but not debug().
If a new loglevel is specified, the logger will change the loglevel and
returns the old loglevel.

### Configuration Methods

### addWriter( writerObject )

Have the logger write log messages with the writer object.  The writerObject must
have a method `write( string, callback )`.  The writer will be called with the
already formatted log line.  Multiple writers are supported.  Writers are run
in the order added, but are not serialized, and writers may complete out of
order.

### addFilter( filterFunction( message, loglevel ) )

A filter modifies the log message before writing it, and returns the filtered
string.  A final built-in filter makes sure that the string ends in a newline.
Filters are applied in the order they were added.

By using filters it is possible to daisy-chain or fan out loggers to have
messages be observed by multiple loggers or logged by multiple agents.  The
very first filter added sees the raw unfiltered message.

        QLogger = require('qlogger');
        logger = new QLogger('info', process.stdout);
        logger.addFilter(
            function(msg, loglevel) {
                return new Date().toISOString() + " [" + QLogger.LEVELNAMES[loglevel]+ "] " + msg;
            }
        );
        logger.info("Hello, world.");
        logger.error("Done.");
        logger.debug("debug messages not enabled");
        // => 2014-10-18T12:34:56.667Z [info] Hello, world.
        // => 2014-10-18T12:34:56.668Z [error] Done.
        // => 

Two very simple filters are included; each adds a timestamp and the loglevel.
`BasicFilter` produces a plaintext logline, the `JsonFilter` a json bundle
with fields "time", "level" and possibly "message".  The json filter can log text or
objects, and can merge fields from a static template object into each logline.
The standard fields "time", "level" and "message" in the template object are
overwritten with the run-time values; this can be used to control the order
of the fields in the output.

### Built-In Filters

#### filter = require('qlogger/filters').BasicFilter.create()

`BasicFilter` produces a plaintext logline with a human-readable timestamp
and the logelevel.

        var filter = require('qlogger/filters').BasicFilter.create();
        logger.addFilter(filter);
        logger.info("Hello, world.")
        // => "2014-10-19 01:23:45.678 [info] Hello, world.\n"

#### filterJson = require('qlogger/filters').JsonFilter.create( template [,opts] )

`filterJson()` logs a stringified json bundle that will always have fields
"time", "level" and "message".  The time is a millisecond timestamp.  Other
fields are copied from the message object being logged (unless a string).
filterJson is constructed by the JsonFilter class.

The json filter can merge fields from a static template into each logline.
The logged bundle fields will contain the template fields, the standard
fields, then all other fields on the logged object, in that order.  The
template can be used to add static info to each logline (e.g. host, version)
and to control the order of the fields in the output.

The standard fields "time", "level" and "message" (and "error" if logging an
Error object), are replaced with run-time values.  If the message itself
contains time, level or message, the fields from the message will be the ones
output.

To omit "level" from the logline, specify `level: false` in the template.
The timestamp "time" will always be set.  "message" will be set if a string
is logged.

        var JsonFilter = require('qlogger/filters').JsonFilter.create();
        var loglineTemplate = {
            // the template defines the basic set of fields to log
            // and the order they will appear in.  If logging objects,
            // any additional fields from the object will be appended.
            // If logging Error objects, the message will be set to
            // the error message, and error:{code:, message:, stack:}
            // will be copied from the Error object.
            time: 'provide',
            level: 'provide',
            custom1: 123,
            message: 'will provide'
        };
        filterJson = JsonFilter.create(loglineTemplate);
        logger.addFilter(filterJson);
        logger.info("Hello, world.");
        // {"time":1414627805981,"level":"info","custom1":123,"message":"Hello, world."}
        logger.info(new Error("oops"));

The json encoding function to use can be specified in `opts.encode`.
The default is JSON.stringify, but for simple json logging
[json-simple](http://npmjs.org/package/json-simple) is 2x faster.

### Timestamp formatting

QLogger exports the simple timestamp formatter used by BasicFilter.  It takes
a millisecond precision timestamp as returned by Date.now(), and formats an
SQL-type ISO 9075 datetime string (YYYY-mm-dd HH:ii:ss, whole seconds, no
timezone).  It's much faster than Date.toISOString, and much much faster than
general-purpose timestamp formatters like moment or phpdate.

BasicFilter appends the milliseconds to the formatted timestamp separately, to
save having to repeatedly format the same time during busts.  Something like

        now = Date.now();
        msec = now % 1000;
        str = formatIsoDate(now - msec);
        str += "." + (msec >= 100 ? msec : msec >= 10 ? "0" + msec : "00" + msec);

Note that although formatting the timestamp takes only .5 microseconds,
logging a line to a file itself is just 1.5 microseconds (per line, average).
Timing it, reusing a formatted timestamp results in 28% faster throughput.


#### formatIsoDate( timestamp )

        var formatIsoDate = require('qlogger/filters').formatIsoDate;
        var timestamp = Date.now();
        // => 1414627805981
        var time = formatIsoDate(timestamp);
        // => 2014-10-29 20:10:05

#### formatIsoDateUtc( timestamp )

        var formatIsoDateUTC = require('qlogger/filters').formatIsoDateUtc;
        var time = formatIsoDate(1414627805981);
        // => 2014-10-30 00:10:05

Related
-------

For pure streaming line-oriented data transport, see
[qfputs](https://www.npmjs.org/package/qfputs) for high-speed batched fputs(), and
[qfgets](https://www.npmjs.org/package/qfgets) for batched fgets().


TODO
----

- only insert time/level/message into json logs if specified in template
  (ie, if using the default template or present in the user-supplied template)
  Omit them if not present in the supplied template.
- maybe log to process.stdout by default instead of not writing?
- make JsonFilter `time` use a function specified in the template
- support a _printit(level, fmt, ...args) method for sprintf-formatted output
- move the constants out into a separate file to not make filters load the dependencies
