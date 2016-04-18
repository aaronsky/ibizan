# Ibizan
_Dog-themed Employee Time Tracking Slack Bot_

[![Build Status](https://travis-ci.org/ibizan/ibizan.svg?branch=master)](https://travis-ci.org/ibizan/ibizan) [![Dependency Status](https://gemnasium.com/ibizan/ibizan.svg)](https://gemnasium.com/ibizan/ibizan) [![Coverage Status](https://coveralls.io/repos/github/ibizan/ibizan/badge.svg?branch=master)](https://coveralls.io/github/ibizan/ibizan?branch=master) [![Gratipay Team](https://img.shields.io/gratipay/team/shields.svg?maxAge=2592000)](https://gratipay.com/ibizan/)

Ibizan is a chat bot built on the [Hubot](https://github.com/github/hubot) framework, originally contracted by [Fangamer](http://fangamer.com/). Ibizan is designed to provide an intuitive and interactive interface to managing a timesheet.

## Setup

This version of Ibizan is ready to be deployed to your Heroku with a little bit of setup. Future versions will be served as a Slack app, so consider the amount of control you want with this bot when using this method.

You must set up your configuration before running Ibizan or else it will not start.

### Google Sheets Spreadsheet

1. Make a copy of [this spreadsheet](https://docs.google.com/spreadsheets/d/1dGmUzvCyA7gIVcHxcYumKh8jy9EeFKeH71wUwTocTHQ/edit?usp=sharing). 
2. Fill in all the relevant values in the "Variables" worksheet
3. Add rows for each of your employees in "Users"
4. Add a row for each name you want Ibizan to consider a project in "Projects". These are designed to correlate to channel names in Slack, but they don't have to.

### Google Drive API Service Account

1. Follow the instructions [here](https://developers.google.com/identity/protocols/OAuth2ServiceAccount)
2. When given the opportunity to download your keys, download it as JSON and save it somewhere safe. Google will only let you do this once, so if you lose it, you won't be able to get it back.
3. Share your spreadsheet (the one you just created) with the email address given in the downloaded JSON.
4. Make note of the client email, the private key, and the spreadsheet ID


### Deploying to Heroku

It's time to deploy to Heroku. It's very important that all the configuration variables are set correctly.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Make note of the app name and FQDN, because you'll need them in the next section. After this deploys correctly, you'll need to set the following configuration variables:

```
NODE_ENV:PRODUCTION
ORG_NAME:{YOUR ORGANIZATION NAME}

# Use the noted information from the last section
SHEET_ID:
CLIENT_EMAIL:
PRIVATE_KEY:

# You'll set these in the next section
HUBOT_SLACK_TOKEN:
SLASH_CALENDAR_TOKEN:
SLASH_HOUND_TOKEN:
SLASH_INFO_TOKEN:
SLASH_PAYROLL_TOKEN:
SLASH_PROJECTS_TOKEN:
SLASH_SYNC_TOKEN:
SLASH_USERS_TOKEN:
SLASH_PUNCH_TOKEN:
```

### Add Hubot to Slack

1. Go to your Slack team's app management page. You may need admin access for this step
2. Add a Hubot as an integration and fill in the details. Make note of the Slack token, which you'll need in the next section.
3. Go back and add the following slash commands as integrations. For the name and image fields, use what you decided on in the Hubot configuration. Make note of all the tokens.

```
Command: /sync
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/sync
Description: Syncs Ibizan with the payroll spreadsheet
Hint:

Command: /ibizan
URL: https://{YOUR HEROKU FQDN}/ibizan/punch
Description: Clock in or out from Slack
Hint: [mode] [time] [date] [projects] [notes]
​
Command: /users
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/users
Description: Send list of user information to Slack
Hint:
​
Command: /projects
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/projects
Description: Send list of project information to Slack
Hint:
​
Command: /calendar
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/calendar
Description: Send list of calendar information to Slack
Hint:
​
Command: /hound
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/hound
Description: Resets hounding for all users
Hint:
​
Command: /payroll
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/payroll
Description: Posts payroll to sheet for range
Hint: [start date] [end date]
​
Command: /info
URL: https://{YOUR HEROKU FQDN}/ibizan/diagnostics/info
Description: Sends status of Ibizan server to Slack
Hint:
```

When you're done setting all these up, fill in the tokens you previously noted into the appropriate configuration variables in Heroku.

If Ibizan doesn't automatically start after you finish setting all the environment variables, use the Heroku Toolbelt to run `heroku restart --app={YOUR APP NAME}` in the terminal.

## Usage

Documentation for Ibizan is ongoing. Please check back at the [project website](http://ibizan.github.io) as new docs get added. This will be fully addressed come the stable 1.0 release.
