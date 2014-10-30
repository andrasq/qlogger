/**
 * Copyright (C) 2014 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

fs = require('fs');
QLogger = require('../index');

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

        'should return loglevel ': function(t) {
            var level = this.logger.loglevel();
            t.equal(QLogger.LOGLEVELS['info'], level);
            t.done();
        },

        'should set loglevel': function(t) {
            var oldlevel = this.logger.loglevel('error');
            var newlevel = this.logger.loglevel();
            t.equal(QLogger.LOGLEVELS['error'], newlevel);
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
            var writer = QLogger.createWriter('tcp://ramnode.com:80');
            t.ok(writer);
            // tcp sockets are closed with 'end'
            writer.end();
            t.done();
        },

        'should create udp:// writer': function(t) {
            var writer = QLogger.createWriter('udp://ramnode.com:80');
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
            t.expect(1);
            this.logger.fflush(function(err) {
                if (err) throw err;
                var contents = fs.readFileSync('/tmp/nodeunit.test.out');
                fs.unlinkSync('/tmp/nodeunit.test.out');
                t.equal("hello\n", contents.toString());
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
            var self = this;
            this.logger.addFilter(function(msg, loglevel) { self.lines.push(loglevel); return msg; });
            this.logger.info("test1");
            this.logger.error("test2");
            t.equal(QLogger.LOGLEVELS['info'], this.lines[0]);
            t.equal(QLogger.LOGLEVELS['error'], this.lines[1]);
            t.done();
        },

        'should apply all filters before writing line': function(t) {
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

        'should not send info to error-only logger': function(t) {
            this.logger = new QLogger('error');
            var self = this;
            this.logger.addWriter({write: function(msg, cb) { self.lines.push(msg); cb(); }});
            this.logger.info("info");
            this.logger.error("error");
            t.equal(1, this.lines.length);
            t.equal("error\n", this.lines[0]);
            t.done();
        }
    },
};
