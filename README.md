# NodeBB Filter Upvotes Plugin

The Filter Upvotes Plugin allows users to customize the way NodeBB notifies them of
upvotes to their posts:

 - All: Default. Users get notified of all upvotes.
 - 1st, 5th, 10th, 25th, 50th, x50: Users get notifications at certain milestones
 - First Only: Only the first upvote generates a notification.
 - None: The user never gets any upvote notifications.

## Developers
In order to run tests, nodebb must be installed as a module via npm link (the package in npm is very old).
First, go to your nodebb directory, then:
`$ sudo npm link`

Next, from this plugin's root directory:
`$ npm link`

You must have a `test_database` configured in nodebb's `config.json` file:
```
"test_database": {
        "host": "127.0.0.1",
        "port": "27017",
        "username": "",
        "password": "",
        "database": "test"
}
```

##Changes
    0.2.0
     - Compatible with NodeBB v1.3, which introduced breaking changes
       in vote handling code.
     - Don't notify user with "-1 votes" notifications on unvotes
    0.1.3
     - Removed extra console.logs
     - Updated tests
    0.1.2
     - Fix regression so both testing and normal plugin initialization work
    0.1.1
     - Check the vote order to account for notification delay
     - Added integration tests
    0.1.0
     - Set the notification level from user settings
