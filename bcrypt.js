/*
 * Copied from nodebb for integration testing purposes.
 */
'use strict';

var bcrypt = require('bcryptjs'),
	async = require('async');


process.on('message', function(msg) {
	if (msg.type === 'hash') {
		hashPassword(msg.password, msg.rounds);
	} else if (msg.type === 'compare') {
		bcrypt.compare(msg.password, msg.hash, done);
	}
});

function hashPassword(password, rounds) {
	async.waterfall([
		function(next) {
			bcrypt.genSalt(parseInt(rounds, 10), next);
		},
		function(salt, next) {
			bcrypt.hash(password, salt, next);
		}
	], done);
}

function done(err, result) {
	if (err) {
		process.send({err: err.message});
		return process.disconnect();
	}
	process.send({result: result});
	process.disconnect();
}
