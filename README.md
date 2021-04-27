qlogger
=======
[![Build Status](https://travis-ci.org/andrasq/qlogger.svg?branch=master)](https://travis-ci.org/andrasq/qlogger)
[![Coverage Status](https://coveralls.io/repos/github/andrasq/qlogger/badge.svg?branch=master)](https://coveralls.io/github/andrasq/qlogger?branch=master)

quick nodejs logging and newline delimited data transport

QLogger is a a very fast logger, also a toolkit for building very fast loggers.  It can be
used out of the box as-is, or it can be easily configured in new ways for custom loggers.
It uses the standard Unix `syslog(2)` loglevels, and is lean, fast, very flexible, and easy to use.

The logger can log in any format, eg space-separated text or json bundles.  Formatting and
writing is done by pluggable _filters_ that transform the log messages, and _writers_ that
record them.  Use one of the several built in, or provide your own.

The built-in createWriter built writer of type `file://` is multi-process safe, it does not
let line fragments from one logger overwrite or interleave with line fragments of another
logger; each line is guaranteed to be logged in its entirety.

If the optional dependency `fs-ext` is present, files writes will be mutexed to ensure that
concurrent writes will each be appended atomically.

And it's nice and fast.  On my system I get 1450k 200 byte lines per second saved to a shared
logfile under LOCK_EX mutex
(writing with [qfputs](https://www.npmjs.org/package/qfputs) without filtering,
or 850k/sec if also adding a timestamp and the loglevel.

A slow logger can report on the data being processed.  A fast logger is a data
streaming engine, and can itself process data.

        const qlogger = require('qlogger');
        const filters = require('qlogger/filters');

        const logger = qlogger('info');
        logger.addFilter(filters.BasicFilter.create());
        logger.addWriter(qlogger.createWriter('file:///var/log/myApp/app.log');

        logger.info('Hello, world.');

`qlogger` is a nodejs rewrite of the `Quick_Logger` PHP logging utility; see
[`quicklib`](https://github.com/andrasq/quicklib).


API
---

### new QLogger( [loglevel], [writer] )

Create a logger that will log messages of `loglevel` importance or above.  It is
an error if the loglevel is not recognized.

Loglevel can be specified as a string 'error', 'info' or 'debug'.  If omitted, it defaults
to 'info'.  Internally, loglevels are converted to the standard unix syslog(2) loglevels 3,
6 and 7.  As of version v1.4.0, all `syslog` loglevels are recognized:  'emerg', 'alert',
'crit', 'err', 'warning', 'notice', 'info' and 'debug', along with 'all' and 'none'.

The optional `writer` may be a writerObject (see addWriter below), or a writer specification
string.  The latter will create one of the built-in writers using `QLogger.createWriter()`.
If no writerSpec is given, the logger will be created without a writer.  Writers can be
added later at any time.  It is an error if the writer specification is not recognized.  The
built-in writers are those supported by createWriter().

### QLogger.createWriter( writerSpec )

This class method will create a new writer corresponding to the spec.
The recognized writer specifications are:

        file://</path/to/file>          // absolute filepath
        file://<file/name>              // relative filename
        stdout://                       // process.stdout
        stderr://                       // process.stderr
        tcp://<host>:<port>             // net.connect() tcp connection
        udp://<host>:<port>             // datagram

The returned writer will have a method `write(str, cb)`, and some also
a method `fflush(cb)`.

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
objects with an `fflush(cb)` method e.g. FileWriter (file://) objects.

#### loglevel( [newLoglevel] )

returns the current loglevel.  The loglevel controls the log sensitivity; a
loglevel of 'info' would write info() and error() messages but not debug().
If a new loglevel is specified, the logger will change the loglevel and
returns the old loglevel.

### Configuration Methods

### addWriter( writerObject )

Have the logger write log messages with the writer object.  The writerObject must have a
method `write( string, callback )`.  The writer will be called with the already formatted
log line.  Multiple writers are supported.  Writers are run in the order added, but are not
serialized, and writers may complete out of order.  If the writer has a method `fflush(
callback )` it will be used when flushing the buffered data.  Qlogger tries to snoop stream
and socket objects to know whether they're busy, other objects should either have an
`fflush` method or will not be checkpointable.

A writer can be any object that records the message, for example:

        const logger = qlogger();
        logger.addWriter({
            write: function(message, callback) {
                const timestamp = new Date().toISOString();
                const levelName = qlogger.LEVELNAMES[loglevel];
                process.stdout.write(timestamp + ' [' + levelName + '] ' + message + '\n', callback);
            },
            fflush: function fflush(callback) {
                process.stdout.write("", callback);
            }
        })

### getWriters( )

Return the array of writers attached to this qlogger.

### removeWriter( writerObject )

Remove the writer object from this qlogger.  The `writerObject` should be the same as was
added with `addWriter`.

### addFilter( filterFunction( message, loglevel ) )

A filter is a function that modifies the message being logged before it is written.  It is
passed two arguments, the message and the current numeric loglevel, and is expected to
return the message to log.  If the final transformed message does not have a terminating
newline, one will be added before writing.  Filters are applied in the order they were
added.

If there is more than one filter on a logger, they will be run in the order added.

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

By using filters it is possible to daisy-chain or fan out loggers to have
messages be observed by multiple loggers or logged by multiple agents.  The
very first filter added sees the raw unfiltered message, each subsequent filter
modifies the result string returned by the previous filter.

        const logger = qlogger('info');
        logger.addFilter(function(message, loglevel) {
            return 'logger says: ' + message;
        })
        logger.addFilter(function(message, loglevel) {
            return 'listen up, ' + message;
        })

        logger.info('hello, world.');
        // => "listen up, logger says: hello, world.\n'

A few simple filters are included with `qlogger`; see below.

### getFilters( )

Return the array of filters attached  to this logger.

### removeFilter( filterFunction )

Remove the filter function from this qlogger.  The function should be the same as was added
wtih `addFilter`.

### Built-In Filters

#### filterBasic = require('qlogger/filters').BasicFilter.create()

Returns a `BasicFilter` function, which produces a plaintext logline with a human-readable
timestamp and the logelevel.

        var filter = require('qlogger/filters').BasicFilter.create();
        logger.addFilter(filter);
        logger.info("Hello, world.")
        // => "2014-10-19 01:23:45.678 [info] Hello, world.\n"

#### filterJson = require('qlogger/filters').JsonFilter.create( template [,opts] )

`filterJson(message, level)` converts to a stringified json bundle with fields "time",
"level" and possibly "message" (unless explicitly disabled by setting them to
`false`).  `time` is a millisecond timestamp, `level` is the name of the message
loglevel.  Other fields are copied from the message object being logged (unless not an
object, in which case the bundle `message` property is set to the logged value).

The json filter can merge fields from a static template into each logline.  The logged
bundle fields will contain the template fields, the standard fields, then all other
fields on the logged object, in that order.  The template can be used to add static
info to each logline (e.g. hostname, version) and to control the order of the fields
in the output.

The standard fields "time", "level" and "message" (and "error" if logging an
Error object), are replaced with run-time values.  If the message itself
contains time, level or message, the fields from the message will be the ones
output.

To omit "time" or "level" from the logline, set them to `false` in the template.
`message` cannot be disabled, since it is automatically set to the logged value
when logging non-objects; is not used otherwise.

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

        logger.info({ a: 1, b: 'two' });
        // {"time":1414627805981,"level":"info","custom1":123,"a":1,"b":"two"}

        logger.info(new Error("oops"));
        // {"time":1414627805981,"level":"info","custom1":123,"message":"Error: oops",
        //  "error":{"code":undefined,"message":"oops","stack":"Error: oops\n    at ..."}}

The json encoding function to use can be specified in `opts.encode`.
The default is `JSON.stringify`.

Options:

- `encode` - encoding function to use to serialize.  Default is `JSON.stringify`
- `timestamp` - function to generate the timestamp value to include in the output,
  eg `filters.formatJsDateIsoString`.  Default is `filters.getTimestamp`.

#### filterKube = require('qlogger/filters').KubeFilter.create( options )

Returns a function that formats log messages as newline terminated k8s (Kubernetes)
compatible json strings, each entry with fields `time`, `type` and `message`.  Unlike
JsonFilter, the logged message is always included as the `message` property and not
merged into the top-level json object.

If `options` is a string, it will be interpreted as the type, as if `{ type: options }`.

        const KubeFilter = require('qlogger/filters').KubeFilter;
        const filter = KubeFilter.create('test-stream');
        let str = filter({ a: 1, b: 2 });
        // => {"time":"2019-02-09T11:05:19.471Z","type":"test-stream","message":{"a":1,"b":2}}

Options:

- `type` - log stream type, default `undefined`.  The type is included in every logline.
- `timestamp` - function to compose the logged timestamp.  Default is `filters.formatJsDateIsoString`.

#### filterPino = require('qlogger/filters').PinoFilter.create( options )

Returns a function that formats log messages as newline terminated Pino compatible json strings
with fields `level`, `time`, `pid`, `hostname`, `name` and either `msg` or the key-values from
the logged hash.

        const PinoFilter = require('qlogger/filters').PinoFilter;
        const filter = PinoFilter.create({name: 'test', hostname: 'vm');
        let str = filter({ a: 1, b: 2 });
        // => {"level":30,"time":1619476931206,"pid":26804,"hostname":"vm","name":"test","a":1,"b":2}


Options:
- `name` - the name of the logger.  Default none.
- `hostname` - the name of the server.  Default `os.hostname()`.
- `pid` - the process id of the logging process.  Default `process.pid`.

### Timestamps

`qlogger` exports its source of high-speed millisecond timestamps.  These timestamps
are tuned for groups of reads close together.

        const filters = require('qlogger/filters');

#### filters.getTimestamp( )

Return the current millisecond timestamp, like `new Date().getTime()`.  The current
timestamp is cached and reused, with a `setTimeout` to invalidate it when it expires.
If the event loop is blocked, the next few timestamps fetched may be stale (up to 50).
Yielding to the event loop with an asynchronous callback, `setTimeout` or `setImmediate`
will refresh the timestamp.

#### filters.getTimestampAsync( callback(err, ms) )

Return the current millisecond timestamp, guaranteed to not be stale.  Freshness is
ensured to within a millisecond of the actual wallclock time by wrapping the callback
in a `setImmediate`, thus letting the timestamp expire first in case the event loop
had been blocked.

### Timestamp Formatting

QLogger exports a few simple timestamp formatters.  The formatters take a millisecond
timestamp as returned by `new Date().getTime()`, and convert it to a datetime string.  The
formatters are very very fast, optimized for realtime timestamps:  faster than
`String(Date.now())`, faster even than `String(count++)`.


#### filters.formatIsoDate( [timestamp] )

SQL ISO-8601 DATETIME, in 'YYYY-MM-DD hh:mm:ss' format, local timezone.

        var timestamp = Date.now();
        // => 1414627805981

        var time = formatIsoDate(timestamp);
        // => 2014-10-29 20:10:05

#### filters.formatIsoDateUtc( [timestamp] )

SQL DATETIME in GMT timezone.

        filters.formatIsoDateUtc(1414627805981);
        // => 2014-10-30 00:10:05

#### filters.formatNumericDateUtc( [timestamp] )

Just the digits from an ISO-8601 datetime, with milliseconds added, in GMT.

        filters.formatNumericDateUtc(1414627805981);
        // => "20141030001005.981"

        filters.formatNumericDateUtc();
        // => "20190203194104.461"

#### filters.formatJsonDate( [timestamp] )

JavaScript `new Date().toISOString()` format, always GMT; same as `new Date().toJSON()`.
Also available as `filters.formatJsDateIsoString`.

        filters.formatJsDateIsoString();
        // => "2019-02-03T19:41:04.461Z"

#### filters.formatBasicDate( [timestamp] )

The generic timestamp used by the BasicFilter, an SQL DATETIME with milliseconds, local timezone.

        filters.formatBasicDate();
        // => "2019-02-03 19:41:04.461"

#### filters.formatRawTimestamp( [timestamp] )

Same as `String(new Date().getTime())`, but possibly faster.

Structure
---------

QLogger sends newline-delimited strings (messages) to writers.  The strings
may be edited in flight by filters.  Filters return the modified string, and
can annotate it with timestamp, loglevel, hostname, etc., or serialize objects
for export.  Writers deliver the strings to their detaination.

Newline delimited text is a universally compatible, easy to scan, and very very fast
way to stream and process data.

Writers can be added to write to file, send over TCP/IP, send to syslog, etc.
The messages can be modified in flight by filters, causing the altered message to
be written.  Common filters would be to add a timestap and the message loglevel.
Writers and filters must be configured explicitly, there is no default.
Each logger supports multiple filters and multiple writers.

Qlogger exports the full set of the `syslog(2)` log reporting levels, from emerg() to
debug():

    #define LOG_EMERG       0       /* system is unusable */
    #define LOG_ALERT       1       /* action must be taken immediately */
    #define LOG_CRIT        2       /* critical conditions */
    #define LOG_ERR         3       /* error conditions */
    #define LOG_WARNING     4       /* warning conditions */
    #define LOG_NOTICE      5       /* normal but significant condition */
    #define LOG_INFO        6       /* informational */
    #define LOG_DEBUG       7       /* debug-level messages */QLogger.ERROR = 3;

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

The above safeguards are built into the `file://` type writers, with
a reopen frequency of 0.05 seconds

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


Related
-------

For pure streaming line-oriented data transport, see
[qfputs](https://www.npmjs.org/package/qfputs) for high-speed batched fputs(), and
[qfgets](https://www.npmjs.org/package/qfgets) for batched fgets().


Todo
----

- support a _printit(level, fmt, ...args) method for sprintf-formatted output
- move the constants out into a separate file to not make filters load the dependencies
