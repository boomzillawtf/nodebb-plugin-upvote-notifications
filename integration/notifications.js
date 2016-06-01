
'use strict';

var assert = require('chai').assert;
var async = require('async');
var validator = require('validator');

var db = require('nodebb/tests/mocks/databasemock');
var categories = require('nodebb/src/categories');
var favourites = require('nodebb/src/favourites');
var notifications = require('nodebb/src/notifications');
var SocketPosts = require('nodebb/src/socket.io/posts');
var topics = require('nodebb/src/topics');
var User = require('nodebb/src/user');
var plugins = require('nodebb/src/plugins');
var pluginJson = require('../plugin.json');

var Upvotes = require('../library')(favourites, db);

describe('Notification\'s', function() {
	before(function(done){
		async.waterfall([
			function(next){
				plugins.toggleActive( pluginJson.id, next );
			}
			,
			function(result,next){
				async.map( pluginJson.hooks, function( hook, map_callback ){
					plugins.registerHook( pluginJson.id, { hook: hook.hook, method: Upvotes[hook.method] }, map_callback )
				},
			   function(){
				   next();
			   });
			}
		],
		done);
	});
	
	describe('.upvote', function() {
		
		var posterUid;
		var voterUids;
		var topicId;
		var categoryId;
		var socket;
		before(function(done) {
			var userData = [
				{
					username: 'Original Poster',
					password: 'swordfish'
				}];
			var i;
			for( i = 0; i < 10; ++i ){
				userData.push({
					username: 'Upvoter ' + i,
					password: 'swordfish' + i
				});
			}
			
			async.waterfall([
				function(next) {
					async.map(userData,
							function(userData, cb) {
								User.create(userData, cb );
							},
							function(err, results){
								assert.isNotOk(err, 'Created users ');
								posterUid = results.splice(0, 1);
								voterUids = results;
								voterUids.reverse();
								next();
							});
				},
				function(next) {
					categories.create({
						name: 'Upvote Test Category',
						description: 'Upvote Test category created by testing script',
						icon: 'fa-chevron-up',
						blockclass: 'category-blue',
						order: '5'
					}, next);
				},
				function(result, next) {
					categoryId = result.cid;
					topics.post({
						uid: posterUid,
						cid: categoryId,
						title: 'Upvotes Test Topic Title',
						content: 'The content of test topic'
					}, next);
				},
				function(result, next) {
					topicId = result.postData.tid;
					next();
				}],done);
		});

		function replyToUpvote(callback) {
			topics.reply({uid: posterUid, content: 'a post to upvote', tid: topicId}, callback);
		}

		function upvote(pid, callback) {
			async.mapSeries(voterUids, function(uid, cb) {
				socket = {};
				socket.uid = uid;
				socket.room_id = 'not a real room';
				var socket_cb = function(err, result){};
				socket.emit = function(foo, bar, socket_cb){};
				SocketPosts.upvote(socket, {pid: pid, cid: categoryId, room_id: 'topic_' + topicId }, cb);
			},
			function(err, votes) {
				assert.isNotOk(err, 'Error upvoting the post');
				async.waterfall([
					function(next){
						favourites.getUpvotedUidsByPids([pid], next);
					},
					function(uids, next){
						uids = uids[0];
						assert.equal(uids.length, voterUids.length, 'Make sure all the votes were counted');
						next();
					}], function(){
						callback();
					});
				
			});
		}

		function setup(setting, callback) {
			var pid;
			async.waterfall([
				function(next) {
					User.getSettings(posterUid, next);
				},
				function(settings, next) {
					settings.upvoteNotificationLevel = setting;
					User.saveSettings(posterUid, settings, next);
				},
				function(settings, next) {
					notifications.markAllRead(posterUid, function(err, results){
						if (err) {
							assert.isNotOk(err, 'error marking all read: ' + err);
						}
						next();
					}
					);
				},
				function(next) {
					db.getSortedSetsMembers(['uid:' + posterUid + ':notifications:unread'], next);
				},
				function(notifications, next) {
					assert.equal(notifications[0].length, 0, 'Expected no unread notifications');
					replyToUpvote(next);
				},
				function(postData, next) {
					next(null, postData.pid);
				}
				], function(err, pid){
					callback(err, pid);
				});
		}
		
		function upvoteAndWait(pid, callback){
			async.waterfall([
				function(next){
					upvote(pid, next);
				},
				function(next) {
					// notifications are on a 1000ms timer, so we need to wait for them to happen
					setTimeout(next, 1200);
				},
				function(next) {
					db.getSortedSetsMembers(['uid:' + posterUid + ':notifications:unread'], next);
				}
			],function(err, unread){
				callback(null, unread[0]);
			});
		}

		it('should pass all upvotes when the configuration is "All"', function(done) {
			async.waterfall([
				function(next) {
					setup(Upvotes.notify_all, next);
				},
				function(pid, next){
					upvoteAndWait(pid, next);
				},
				function(notifications, next) {
					assert.equal(notifications.length, voterUids.length, 'Expected to get a notification for each upvote');
					next();
				}
			],done);
			
		});

		it('should pass 3 upvotes when the configuration is "threshold"', function(done) {
			async.waterfall([
				function(next) {
					setup(Upvotes.notify_threshold, next);
				},
				function(pid, next){
					upvoteAndWait(pid, next);
				},
				function(notifications, next) {
					assert.equal(notifications.length, 3, 'Expected to get a notification for each upvote');
					next();
				}
			],done);
			
		});

		it('should pass 1 upvote when the configuration is "first"', function(done) {
			async.waterfall([
				function(next) {
					setup(Upvotes.notify_first, next);
				},
				function(pid, next){
					upvoteAndWait(pid, next);
				},
				function(notifications, next) {
					assert.equal(notifications.length, 1, 'Expected to get a notification for each upvote');
					next();
				}
			],done);
			
		});

		it('should pass no upvotes when the configuration is "none"', function(done) {
			async.waterfall([
				function(next) {
					setup(Upvotes.notify_none, next);
				},
				function(pid, next){
					upvoteAndWait(pid, next);
				},
				function(notifications, next) {
					assert.equal(notifications.length, 0, 'Expected to get no notifications for each upvote');
					next();
				}
			],done);
		});
        
		it('should not send a notification when a user has changed his vote to a downvote', function(done){
			var uid = voterUids[0];
			var pid;
			async.waterfall([
				function(next){
					setup(Upvotes.notify_first, next);
				},
				function(_pid, cb) {
					pid = _pid;
					socket = {};
					socket.uid = uid;
					socket.room_id = 'not a real room';
					var socket_cb = function(err, result){};
					socket.emit = function(foo, bar, socket_cb){};
					SocketPosts.upvote(socket, {pid: pid, cid: categoryId, room_id: 'topic_' + topicId }, cb);
				},
				function(next) {
					// notifications are on a 1000ms timer, so we need to wait for them to happen
					setTimeout(next, 500);
				},
				function(cb) {
					socket = {};
					socket.uid = uid;
					socket.room_id = 'not a real room';
					var socket_cb = function(err, result){};
					socket.emit = function(foo, bar, socket_cb){};
					SocketPosts.downvote(socket, {pid: pid, cid: categoryId, room_id: 'topic_' + topicId }, cb);
				},
				function(next) {
					// notifications are on a 1000ms timer, so we need to wait for them to happen
					setTimeout(next, 1200);
				},
				function(next) {
					db.getSortedSetsMembers(['uid:' + posterUid + ':notifications:unread'], next);
				},
				function(notifications, next){
					notifications = notifications[0];
					console.log(notifications);
					assert.equal(notifications.length, 0, 'Expected to get no notifications for a switched vote: ' + JSON.stringify(notifications) );
					next();
				}
			], done);
		});
	});
});
