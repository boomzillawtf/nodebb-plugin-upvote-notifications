'use strict';

var async = require('async');
var favourites = module.parent.require('./favourites');
var db = module.parent.require('./database');
var Upvotes = {},
	app;


Upvotes.notify_all = 'all';
Upvotes.notify_threshold = 'threshold';
Upvotes.notify_first = 'first';
Upvotes.notify_none = 'none';

Upvotes.upvoteNotificationOptions = [
	{value: Upvotes.notify_all        ,name: '[[upvotenotifications:notify_all]]',        selected: false},
	{value: Upvotes.notify_threshold  ,name: '[[upvotenotifications:notify_threshold]]',  selected: false},
	{value: Upvotes.notify_first      ,name: '[[upvotenotifications:notify_first]]',      selected: false},
	{value: Upvotes.notify_none       ,name: '[[upvotenotifications:notify_none]]',       selected: false}
];

Upvotes.getNotificationSetting = function(uid, callback){
	db.getObjectField('user:' + uid + ':settings', 'upvoteNotificationLevel', callback );
};


/*
 notification.push
{ notification: 
   { bodyShort: '[[notifications:upvoted_your_post_in, Upvoting-User, Topic-Title]]',
     bodyLong: '<p>The post content is here</p>\n',
     pid: '194',
     path: '/post/194',
     nid: 'post:194:uid:2',
     from: 2,
     mergeId: 'notifications:upvoted_your_post_in|194',
     topicTitle: 'The Topic Title',
     importance: 5,
     datetime: 1463771826364 },
  uids: [ 1 ] }
*/
Upvotes.filterNotificationPush = function(data, callback){
	var notification = data.notification;
	if( notification.bodyShort.indexOf('[[notifications:upvoted_your_post_in,') == 0 ){
		// only interested in upvotes
		var uid = data.uids[0];
		var notificationSetting;
		async.waterfall([
			function(next){
				Upvotes.getNotificationSetting(uid, next);
			},
			function( _notificationSetting, next ){
				if( !_notificationSetting || _notificationSetting == Upvotes.notify_all ){
					return next(null, '');
				}
				else if( _notificationSetting == Upvotes.notify_none ){
					data.uids = [];
					return next(null, '');
				}
				else{
					notificationSetting = _notificationSetting;
					return favourites.getUpvotedUidsByPids([notification.pid], next);
				}
			},
			function( uids, next ){
				if( uids && Array.isArray(uids) ){
					uids = uids[0];
					var votes = uids.length;
					if( votes != 1 ){
						// first upvote gets notified for first and threshold always...
						if( notificationSetting == Upvotes.notify_threshold ){
							if( [5,10,25,50].indexOf(votes) != -1 || votes % 50 == 0 ){
								// they get it! let's update it for the multiples
								// bodyShortValue = '[[' + notification + '_multiple, ' + results.username + ', ' + (uids.length-1) + ', ' + titleEscaped + ']]';
								var parts = notification.bodyShort.split(",");
								data.notification.bodyShort = parts[0] + '_multiple,' + parts[1] + ', ' + (votes) + ', ' + parts[2];
								data.notification.mergeId = 'notifications:upvoted_your_post_in_multiple|' + notification.pid;
								return db.setObject('notifications:' + notification.nid, notification, next);
							}
							else{
								data.uids = [];
							}
						}
						else{
							data.uids = [];
						}
					}
				}
				next();
			}
		], function(){callback(null, data)});
	}
	else{
		return callback( null, data );
	}
};

Upvotes.filterUserCustomSettings = function(data, callback) {
	// data = {settings: {}, customSettings: [], uid: req.uid}
	if( !data.settings.upvoteNotificationLevel ){
		data.settings.upvoteNotificationLevel = Upvotes.notify_all;
	}
	
	// This adds an HTML block to the user's settings page.
	// 'data-property' is what it will be saved as when sent to 'actionSaveSettings' below.
	var html = '\n' +
		'<div>\n' +
		'	<select class="form-control" data-property="upvoteNotificationLevel">\n' +
		'		<option ' + (data.settings.upvoteNotificationLevel == Upvotes.notify_all ? 'selected="selected"' : '') + ' value="' + Upvotes.notify_all + '">[[upvotenotifications:notify_all]]</option>\n' +
		'		<option ' + (data.settings.upvoteNotificationLevel == Upvotes.notify_threshold ? 'selected="selected"' : '') + ' value="' + Upvotes.notify_threshold + '">[[upvotenotifications:notify_threshold]]</option>\n' +
		'		<option ' + (data.settings.upvoteNotificationLevel == Upvotes.notify_first ? 'selected="selected"' : '') + ' value="' + Upvotes.notify_first + '">[[upvotenotifications:notify_first]]</option>\n' +
		'		<option ' + (data.settings.upvoteNotificationLevel == Upvotes.notify_none ? 'selected="selected"' : '') + ' value="' + Upvotes.notify_none + '">[[upvotenotifications:notify_none]]</option>\n' +
		'	</select><br />\n' +
		'</div>\n';
	data.customSettings.push( { 
		title: "[[upvotenotifications:settings_header]]",
		content: html
	} );

	callback(null, data);
};

// Make sure the setting is always defined when I get a user's settings.
Upvotes.filterUserGetSettings = function (data, next) {
	if (!data.settings.upvoteNotificationLevel){
		data.settings.upvoteNotificationLevel = Upvotes.notify_all;
	}
	next(null, data);
};

// Here, I am saving the custom settings to the user's setting object. data.settings is populated with my custom settings from the 'data-property' above.
// Here is also where I could check if the setting has changed, and take appropriate action.
Upvotes.actionUserSaveSettings = function (data, next) {
	db.setObjectField('user:' + data.uid + ':settings', 'upvoteNotificationLevel', data.settings.upvoteNotificationLevel);
};



module.exports = Upvotes;
