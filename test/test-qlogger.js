/**
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

fs = require('fs');
QLogger = require('../index');
filterBasic = require('../filters').filterBasic;
filterJson = (require('../filters')).JsonFilter.makeFilter({})

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
            t.equal(6, QLogger.LOGLEVELS['info']);
            t.equal(7, QLogger.LOGLEVELS['debug']);
            t.done();
        },

        'should expose loglevel names inverse lookup map class attribute': function(t) {
            t.ok(QLogger.LEVELNAMES);
            t.equal('error', QLogger.LEVELNAMES[3]);
            t.equal('info', QLogger.LEVELNAMES[6]);
            t.equal('debug', QLogger.LEVELNAMES[7]);
            t.done();
        },

        'should have createWriter class method': function(t) {
            t.equal('function', typeof QLogger.createWriter);
            t.done();
        },
    },

    'instance': {
        'should export the logging methods': function(t) {
            var methods = ['error', 'err', 'warning', 'warn', 'info', 'debug'];
            var i;
            for (i=0; i<methods.length; i++) {
                var method = methods[i];
                this.logger[method]("log message");
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
    },

    'writers': {
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
            var writer = QLogger.createWriter('tcp://localhost:80');
            writer.on('error', function() {
                t.ok(false, "no localhost http server, unable to test tcp");
                t.done();
            });
            writer.on('connect', function() {
                writer.end();
                t.ok(writer);
                t.done();
            });
        },

        'should create udp:// writer': function(t) {
            var writer = QLogger.createWriter('udp://localhost:80');
            t.ok(writer);
            // udp sockets are closed with 'close'
            writer.close();
            t.done();
        },

        'should create file:// writer': function(t) {
            var writer = QLogger.createWriter('file:///tmp/nodeunit.test.out');
            t.ok(writer);
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
    },
};
