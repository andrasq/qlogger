/**
 * Copyright (C) 2014,2019,2021 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var fs = require('fs');
var net = require('net');
var util = require('util');
var Stream = require('stream');
var QLogger = require('../index');
var filterBasic = require('../filters').filterBasic;
var filterJson = (require('../filters')).JsonFilter.makeFilter({})

module.exports = {
    setUp: function(done) {
        this.lines = [];
        this.logger = new QLogger('info');
        done();
    },

    'class': {
        'should expose loglevel map class attribute': function(t) {
            t.ok(QLogger.LOGLEVELS);
            t.equal(3, QLogger.LOGLEVELS['error']);
            t.equal(4, QLogger.LOGLEVELS['warn']);
            t.equal(6, QLogger.LOGLEVELS['info']);
            t.equal(7, QLogger.LOGLEVELS['debug']);
            t.equal(8, QLogger.LOGLEVELS['trace']);
            t.done();
        },

        'should expose loglevel names inverse lookup map class attribute': function(t) {
            t.ok(QLogger.LEVELNAMES);
            t.equal('error', QLogger.LEVELNAMES[3]);
            t.equal('warning', QLogger.LEVELNAMES[4]);
            t.equal('info', QLogger.LEVELNAMES[6]);
            t.equal('debug', QLogger.LEVELNAMES[7]);
            t.equal('trace', QLogger.LEVELNAMES[8]);
            t.done();
        },

        'should have createWriter class method': function(t) {
            t.equal('function', typeof QLogger.createWriter);
            t.done();
        },
    },

    'instance': {
        'constructor should create writer by name': function(t) {
            var logger = new QLogger('info', 'null://');
            t.deepEqual(Object.keys(logger._writers[0]), ['write']);
            t.done();
        },

        'constructor should accept a writer object': function(t) {
            var writer = {write: function(){}};
            var logger = new QLogger('info', writer);
            t.equal(logger._writers[0], writer);
            t.done();
        },

        'should get and remove writers': function(t) {
            var writer1 = { write: function() {} };
            var writer2 = { write: function() {} };

            var logger = new QLogger('info', writer1);
            t.deepEqual(logger.getWriters(), [ writer1 ]);
            logger.addWriter(writer2);
            t.deepEqual(logger.getWriters(), [writer1, writer2]);
            logger.removeWriter(writer1);
            t.deepEqual(logger.getWriters(), [writer2]);

            logger.removeWriter({});
            logger.removeWriter(7);

            t.done();
        },

        'should add, get and remove filters': function(t) {
            var filter1 = function() {};
            var filter2 = function() {};

            this.logger.removeFilter(7);
            this.logger.addFilter(filter1);
            t.deepEqual(this.logger.getFilters(), [filter1]);
            this.logger.addFilter(filter2);
            t.deepEqual(this.logger.getFilters(), [filter1, filter2]);
            this.logger.removeFilter(filter1);
            t.deepEqual(this.logger.getFilters(), [filter2]);

            this.logger.removeFilter(filter1);
            this.logger.removeFilter({});

            t.done();
        },

        'constructor should work as a factory without new': function(t) {
            var logger = QLogger();
            t.ok(logger instanceof QLogger);
            t.done();
        },

        'constructor should throw on invalid loglevel': function(t) {
            t.throws(function() {
                new QLogger('nonesuch');
            })
            t.done();
        },

        'should export the logging methods': function(t) {
            var methods = ['panic', 'emerg', 'alert', 'crit', 'error', 'err', 'warning', 'warn', 'notice', 'info', 'debug'];
            var i, lastMessage = [];
            this.logger.loglevel('all');
            this.logger.addFilter(function(message, level) {
                lastMessage = [message, level];
                return '';
            })
            for (i=0; i<methods.length; i++) {
                var method = methods[i];
                t.equal(typeof this.logger[method], 'function', 'typeof ' + method);
                this.logger[method](method);
                t.deepEqual(lastMessage, [method, QLogger.LOGLEVELS[method]]);
            }
            t.done();
        },

        'should log with all logging methods': function(t) {
            var wrote = [];
            var logger = new QLogger(QLogger.LOGLEVELS.LOG_ALL);
            logger.addFilter(function(str, level) { wrote.push([str, level]) });
            var methods = ['emerg', 'alert', 'crit', 'error', 'err', 'warning', 'warn', 'notice', 'info', 'debug'];
            for (var i=0; i<methods.length; i++) logger[methods[i]](methods[i]);
            for (var i=0; i<wrote.length; i++) {
                t.equal(wrote[i][0], methods[i]);
                t.equal(wrote[i][1], QLogger.LOGLEVELS[wrote[i][0]]);
            }
            t.done();
        },

        'should set and get the loglevel': function(t) {
            var levels = ['error', 'warning', 'info', 'debug'];
            var i;
            for (i=0; i<levels.length; i++) {
                var level = levels[i];
                this.logger.loglevel(level);
                t.equal(this.logger.loglevel(), QLogger.LOGLEVELS[level]);
            }
            t.done();
        },

        'loglevel should throw on invalid loglevel': function(t) {
            var logger = this.logger;
            t.throws(function() {
                logger.loglevel('nonesuch');
            })
            t.done();
        },
    },

    'logging': {
        setUp: function(done) {
            this.lines = [];
            var self = this;
            this.logger.addWriter({write: function(msg, cb) { self.lines.push(msg); cb(); }});
            done();
        },

        'should newline terminate lines': function(t) {
            this.logger.info("hello");
            t.equal("hello\n", this.lines[0]);
            t.done();
        },

        'should send data to each writer': function(t) {
            var self = this;
            this.lines2 = [];
            this.logger.addWriter({write: function(msg, cb) { self.lines2.push(msg); cb(); }});
            this.logger.info("hello");
            t.equal("hello\n", this.lines[0]);
            t.equal("hello\n", this.lines2[0]);
            t.done();
        },

        'log() should log with default loglevel': function(t) {
            var calls = [];
            this.logger.addFilter(function(msg, loglevel) { calls.push({msg: msg, level: loglevel}); return msg; });
            this.logger.loglevel('error');
            this.logger.log("test");
            t.equal(calls.length, 1);
            t.equal(calls[0].level, QLogger.LOG_ERROR);
            t.deepEqual(calls[0].msg, "test");
            t.done();
        },

        'log() should gathers arguments into array': function(t) {
            var calls = [];
            this.logger.addFilter(function(msg, loglevel) { calls.push({msg: msg, level: loglevel}); return msg; });
            this.logger.loglevel('error');
            this.logger.log(1, 2, 3);
            t.deepEqual(calls[0].msg, [1,2,3]);
            t.done();
        },

        'should omit empty messages': function(t) {
            this.logger.info("");
            t.equal(this.lines.length, 0);
            t.done();
        },

        'should cast to string if filters do not': function(t) {
            var wrote = [];
            this.logger.addWriter({ write: function(str, cb) { wrote.push(str); cb() } });
            this.logger.info(123);
            this.logger.info([1, 2, 3]);
            t.equal(wrote[0], '123\n');
            t.equal(wrote[1], String([1, 2, 3]) + '\n');
            t.done();
        },
    },

    'errors': {
        'should gather write erorrs and report them to fflush': function(t) {
            var writer = {write: function(str, cb) { return cb(new Error("write error")) }};
            var logger = this.logger;
            logger.addWriter(writer);
            logger.info('test');
            logger.info('test');
            t.equal(logger._writeErrors.length, 2);
            t.equal(logger._writeErrors[0].message, "write error");
            logger.fflush(function(err) {
                t.ok(err);
                t.equal(err.length, 2);
                t.equal(err[0].message, "write error");
                t.equal(logger._writeErrors.length, 0);
                t.done();
            })
        },

        'should report fflush errors': function(t) {
            var writer = {write: function(str, cb) { cb() }, fflush: function(cb) { cb(new Error("fflush error")) }};
            var logger = this.logger;
            logger.addWriter(writer);
            logger.fflush(function(err, ret) {
                t.ok(err);
                t.equal(err.message, "fflush error");
                t.done();
            })
        },
    },

    'writers': {
        'should create functional null:// mock writer': function(t) {
            var writer = QLogger.createWriter('null://');
            writer.write("test", function(err) {
                t.ifError(err);
                t.done();
            })
        },

        'should create file://- stdout writer': function(t) {
            var writer = QLogger.createWriter('file://-');
            t.equal(process.stdout, writer);
            t.done();
        },

        'should create stdout:// writer': function(t) {
            var writer = QLogger.createWriter('stdout://');
            t.equal(process.stdout, writer);
            t.done();
        },

        'should create stderr:// writer': function(t) {
            var writer = QLogger.createWriter('stderr://');
            t.equal(process.stderr, writer);
            t.done();
        },

        'should create tcp:// writer': function(t) {
            t.expect(1);
            var server = net.createServer(function(socket) {
            });
            server.on('error', function(err) {
                t.done(err);
            })
            server.listen(1337, 'localhost', function() {
                var writer = QLogger.createWriter('tcp://localhost:1337');
                writer.on('error', function() {
                    t.ok(false, "no localhost tcp server, unable to test tcp");
                    t.done();
                });
                writer.on('connect', function() {
                    writer.end();
                    t.ok(writer);
                    server.close(function() {
                        t.done();
                    });
                });
            })
        },

        'should create udp:// writer': function(t) {
            var writer = QLogger.createWriter('udp://localhost:80');
            t.ok(writer);
            // udp sockets are closed with 'close'
            writer.close();
            t.done();
        },

        'udp:// writer should return error if line too long': function(t) {
            var writer = QLogger.createWriter('udp://localhost:80');
            var stub = t.stub(process.stderr, 'write');
            writer.write("xxx", function(err) {
                t.ifError(err);
                writer.write(new Array(70000).join('x'), function(err) {
                    t.ok(err);
                    stub.restore();
                    t.done();
                });
            })
        },

        'should create file:// writer': function(t) {
            var writer = QLogger.createWriter('file:///tmp/nodeunit.test.out');
            t.ok(writer);
            t.done();
        },

        'should throw if Fputs is needed but not available': function(t) {
            t.disrequire('qfputs');
            t.disrequire('../lib/qlogger');
            // mockRequire mocks only with truthy values
            t.mockRequire('qfputs', 1);
            var QLogger = require('../lib/qlogger');

            // does not throw if not needed: uses stdout
            QLogger.createWriter('file://-');

            // throws if needed: cannot create file writer
            t.throws(function() { QLogger.createWriter('file://tmp/nodeunit.test.out') }, /not available/);

            t.unmockRequire('qfputs');
            t.disrequire('qfputs');
            t.disrequire('../lib/qlogger');
            t.done();
        },

        'should write data to file:// writer': function(t) {
            var writer = QLogger.createWriter('file:///tmp/nodeunit.test.out');
            try { fs.unlinkSync('/tmp/nodeunit.test.out'); } catch (e) { }
            this.logger.addWriter(writer);
            this.logger.info("hello");
            this.logger.info("there");
            t.expect(1);
            this.logger.fflush(function(err) {
                if (err) throw err;
                var contents = fs.readFileSync('/tmp/nodeunit.test.out');
                fs.unlinkSync('/tmp/nodeunit.test.out');
                t.equal("hello\nthere\n", contents.toString());
                t.done();
            });
        },

        'should throw on invalid writer selector': function(t) {
            t.throws(function() {
                QLogger.createWriter('nonesuch://');
                t.fail("did not throw");
            })
            t.done();
        },

        'should return error on invalid writer selector': function(t) {
            QLogger.createWriter('nonesuch://', function(err) {
                t.ok(err);
                t.done();
            })
        },

        'should return error if tcp writer cannot connect': function(t) {
            QLogger.createWriter('tcp://localhost:1', function(err) {
                t.ok(err);
                t.done();
            })
        },
    },

    'fflush': {
        'should assume busy if Stream.Writable needDrain or writing': function(t) {
            if (!Stream.Writable) t.skip();     // omit on node-v0.8
            var stream = new Stream.Writable();
            this.logger.addWriter(stream);

            stream._writableState.needDrain = true;
            stream._writableState.writing = true;
            setTimeout(function() { stream._writableState.needDrain = false }, 50);
            setTimeout(function() { stream._writableState.writing = false }, 100);

            var t1 = Date.now();
            this.logger.fflush(function() {
                var t2 = Date.now();
                t.ok(t2 - t1 >= 100 - 1);
                t.done();
            })
        },

        'should assume busy if net.Socket bufferSize not zero': function(t) {
            var server = net.createServer(function(socket) {});
            server.on('error', function(err) { t.done(err) });
            var self = this;
            server.listen(1337, 'localhost', function() {
                var socket = QLogger.createWriter('tcp://localhost:1337', function(err) {
                    t.ifError(err);
                    socket.on('error', function(err) { t.ifError(err, 'socket create error') });
                    self.logger.addWriter(socket);

                    Object.defineProperty(socket, 'bufferSize', { value: 1234, enumerable: true, writable: true });
                    socket._writableState = socket._writableState || {};
                    socket._writableState.needDrain = true;
                    socket._writableState.writing = true;
                    setTimeout(function() { socket.bufferSize = 0 }, 25);
                    setTimeout(function() { socket._writableState.needDrain = false }, 50);
                    setTimeout(function() { socket._writableState.writing = false }, 100);

                    var t1 = Date.now();
                    self.logger.fflush(function(err) {
                        var t2 = Date.now();
                        t.ok(t2 - t1 >= 25 - 1);
                        if (Stream.Writable) t.ok(t2 - t1 >= 100 - 1);
                        server.close();
                        t.done();
                    })
                })
            })
        },

        'should tolerate fflush that throws': function(t) {
            var called = false;
            this.logger.addWriter({
                write: function(str, cb) { cb() },
                fflush: function() { called = true; throw new Error('test error') }
            });
            this.logger.fflush(function(err) {
                t.ifError(err);
                t.ok(called);
                t.done();
            })
        },

        'should tolerate stream.Writable without _writableState': function(t) {
            if (!Stream.Writable) t.skip();     // omit on node-v0.8
            var stream = new Stream.Writable();
            this.logger.addWriter(stream);
            delete stream._writableState;
            this.logger.fflush(function(err) {
                t.ifError(err);
                t.done();
            })
        },
    },

    'filters': {
        setUp: function(done) {
            this.lines = [];
            done();
        },

        'should pass loglevel to filter': function(t) {
            var levels = [];
            this.logger.addFilter(function(msg, loglevel) { levels.push(loglevel); return msg; });
            this.logger.info("test1");
            this.logger.error("test2");
            t.equal(QLogger.LOGLEVELS['info'], levels[0]);
            t.equal(QLogger.LOGLEVELS['error'], levels[1]);
            t.done();
        },

        'should apply all filters and newline terminate before writing line': function(t) {
            var self = this;
            this.logger.addWriter({write: function(msg, cb) { self.lines.push(msg); cb(); }});
            this.logger.addFilter(function(msg, loglevel) { return "a<" + msg; });
            this.logger.addFilter(function(msg, loglevel) { return msg + ">b"; });
            this.logger.info("hello");
            this.logger.info("there");
            t.equals(this.lines[0], "a<hello>b\n");
            t.equals(this.lines[1], "a<there>b\n");
            t.done();
        },

        'should only log errors to error-only logger': function(t) {
            this.logger = new QLogger('error');
            var self = this;
            this.logger.addWriter({write: function(msg, cb) { self.lines.push(msg); cb(); }});
            this.logger.debug("debug");
            this.logger.info("info");
            this.logger.warning("warning");
            this.logger.error("error");
            t.equal(1, this.lines.length);
            t.equal("error\n", this.lines[0]);
            t.done();
        }
    },

    'serializers': {
        setUp: function(done) {
            this.lines = [];
            done();
        },

        'combine arguments': function(t) {
            var self = this;
            this.logger.addWriter({write: function(msg, cb) { self.lines.push(msg); cb(); }});
            this.logger.setSerializer(util.format);

            this.logger.info('Hello');
            t.equal(this.lines.pop(), 'Hello\n');
            this.logger.info('Hello', 'there');
            t.equal(this.lines.pop(), 'Hello there\n');
            this.logger.info('%s %d', 'Hello', 123, 4.5);
            t.equal(this.lines.pop(), 'Hello 123 4.5\n');

            t.done();
        },
    },

    'speed': {
        'log 100k lines with no-op writer': function(t) {
            this.logger.addWriter({write: function(data, cb){ cb(); }});
            for (var i=0; i<100000; i++) this.logger.info("Hello, world.\n");
            this.logger.fflush(function(){
                t.done();
            });
        },

        'log 100k lines with /dev/null FileWriter': function(t) {
            this.logger.addWriter(QLogger.createWriter('file:///dev/null'));
            for (var i=0; i<100000; i++) this.logger.info("Hello, world.\n");
            this.logger.fflush(function(){
                t.done();
            });
        },

        'log 10k lines with /dev/null FileWriter basicFilter': function(t) {
            this.logger.addWriter(QLogger.createWriter('file:///dev/null'));
            this.logger.addFilter(filterBasic);
            for (var i=0; i<10000; i++) this.logger.info("Hello, world.\n");
            this.logger.fflush(function(){
                t.done();
            });
        },

        'log 10k lines with /tmp/nodeunit.tmp FileWriter basicFilter': function(t) {
            this.logger.addWriter(QLogger.createWriter('file:///tmp/nodeunit.tmp'));
            this.logger.addFilter(filterBasic);
            for (var i=0; i<10000; i++) this.logger.info("Hello, world.\n");
            this.logger.fflush(function(){
                t.done();
                fs.unlinkSync('/tmp/nodeunit.tmp');
            });
        },

        'log 10k lines with /dev/null writeStream basicFilter': function(t) {
            this.logger.addWriter(fs.createWriteStream('/dev/null', {flags: 'a'}));
            this.logger.addFilter(filterBasic);
            for (var i=0; i<10000; i++) this.logger.info("Hello, world.\n");
            this.logger.fflush(function(){
                t.done();
            });
        },

        'log 100k lines with util.format serializer': function(t) {
            this.logger.setSerializer(util.format);
            for (var i=0; i<100000; i++) this.logger.info("Hello, %s.\n", "world");
            this.logger.fflush(function(){
                t.done();
            });
        },

        'log 100k lines with JSON.stringify serializer': function(t) {
            var line;
            this.logger.setSerializer(function(info, msg) { return msg ? { info: info, msg: msg } : info });
            this.logger.addFilter(function(msg) { return JSON.stringify(msg) });
            for (var i=0; i<100000; i++) this.logger.info("Hello, %s.\n", "world");
            this.logger.fflush(function(){
                t.done();
            });
        },
    },
};
