qlogger
=======

quick configurable nodejs logger and newline delimited data transport

QLogger is a very lean, very configurable logger and data transport agent.  At
its most basic level, it sends newline-delimited strings to the writers.  On
my system I get 400k 200 byte lines logged per second to a shared, mutexed
logfile (for unfiltered data transport, see also [qfputs](https://www.npmjs.org/package/qfputs)).

### Installation

        npm install qlogger

or clone the repo, `git clone https://github.com/andrasq/qlogger`

### Description

Writers can be added to write to file, send over TCP/IP, send to syslog, etc.
The strings can be modified in flight by filters, which will write the altered
string.  Common filters would be to add a timestap and the message loglevel.
Writers and filters must be configured explicitly, there is no default.

QLogger exports a simplified subset of the traditional logging methods:
error, info, and debug.  Each log message is appended to the logfile
as a newline delimited data chunk.

Newline delimited text is a universally compatible, easy-to-parse and
very very fast way to stream and process data.

Points to keep in mind for general-purpose data transport logfiles:
  - the logfile might have multiple writers and unix writes are not atomic,
    ie writes need a mutex
  - the logfile might be consumed by simple readers, so each write should
    be a complete newline terminated data item (message)
  - the logfile might get consumed (renamed or removed), ie must reopen
    the file periodically
  - the logfile could be used for high-speed low-latency buffering, so
    the logfile reopen interval should be pretty short

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

### QLogger( [loglevel], [writerSpec] )

Create a logger that will log messages of importance loglevel or above.  It is
an error if the loglevel is not recognized.

Loglevel can be specified as a string 'error', 'info' or 'debug'.  If
omitted, it defaults to 'info'.  Internally, they are converted to the
standard unix syslog loglevels 3, 6 and 7.  The higher syslog logging
levels (emerg, alert, and crit) and warning and notice were deliberately
omitted, leaving just the three essential message classes:  human
attention required, useful statistics, and everything available for
debugging.

The optional WriterSpec may be a writerObject (see addWriter below), or a
writer specification string.  The latter will create one of the built-in
writers.  If no writerSpec is given, the logger will be created without a
writer.  It is an error if the writer specification is not recognized.  The
built-in writers are those supported by QLogger.createWriter() (see below):

### QLogger.createWriter( writerSpec )

This class method will create a new writer corresponding to the spec.
The recognized writer specifications are:

        file://</path/to/file>          // absolute filepath
        file://<file/name>              // relative filename
        stdout://                       // process.stdout
        stderr://                       // process.stderr
        tcp://<host>:<port>             // tcp connection
        udp://<host>:<port>             // datagram

### loglevel( [newLoglevel] )

returns the current loglevel.  The loglevel controls the log sensitivity; a
loglevel of 'info' would write info() and error() messages but not debug().
If a new loglevel is specified, the logger will change the loglevel and
returns the old loglevel.

### addWriter( writerObject )

Have the logger write log messages with this object.  The writerObject must
have a method `write( string, callback )`.  The writer will be called with the
already formatted log line.  Multiple writers are supported.  Writers are run
in the order added, but are not serialized, and writers may complete out of
order.

### addFilter( filterFunction( message, loglevel ) )

Filter the log message before writing it, and return the filtered string.  The
only message filtering built in is to make sure that the message ends in a
newline.  Each filter is free to modify the log message about to be written.
Filters are applied in the order they were added.

By using filters it is possible to daisy-chain loggers so messages are
observed and logged to multiple locations.

### error( message )

Log an error message.  Error messages will be logged by all loglevels,
'error', 'info' and 'debug'.

### info( message )

Log an informational message.  The logger must have loglevel 'info' or
'debug'.

### debug( message )

Log a debug message.  The logger must have loglevel of 'debug'.

### fflush( callback )

Tries to force all writers to write out any buffered data.  Invokes the
callback once the writes have all finished.  This is a half-hearted
implementation, since fflush can only flush write streams, tcp sockets and
FileWriter (file://) objects.
