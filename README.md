# Ibizan
_Dog-themed Employee Time Tracking Slack Bot_

[![Build Status](https://travis-ci.org/fangamer/ibizan.svg?branch=master)](https://travis-ci.org/fangamer/ibizan) [![Dependency Status](https://gemnasium.com/fangamer/ibizan.svg)](https://gemnasium.com/fangamer/ibizan) [![Coverage Status](https://coveralls.io/repos/github/fangamer/ibizan/badge.svg?branch=master)](https://coveralls.io/github/fangamer/ibizan?branch=master)

Ibizan is a chat bot built on the [Hubot](https://github.com/github/hubot) framework, contracted by [Fangamer](http://fangamer.com/). Ibizan is dedicated to providing an intuitive and interactive interface to managing a timesheet.

## Running ibizan Locally

After cloning the repo and setting the created folder to your current directory, you can test Ibizan hubot by running the following command:

```
npm start
```

This will install dependencies and run the bot. However, it will not work without setting up your configuration (below).

## Configuration

You must set up your configuration before running Ibizan or else it will not start.

### Google Sheets Spreadsheet

In its current form, Ibizan punch functionality is tightly coupled to the layout of the spreadsheet it pulls from.

1. Make a copy of [this spreadsheet](https://docs.google.com/spreadsheets/d/1dGmUzvCyA7gIVcHxcYumKh8jy9EeFKeH71wUwTocTHQ/edit?usp=sharing). 
2. Fill in all the relevant values in the "Variables" worksheet
3. Add rows for each of your employees in "Users"
4. Add a row for each name you want Ibizan to consider a project in "Projects". These are designed to correlate to channel names in Slack, but they don't have to.

### Google Drive API Service Account

1. Follow the instructions [here](https://developers.google.com/identity/protocols/OAuth2ServiceAccount)
2. When given the opportunity to download your keys, download it as JSON and save it somewhere safe. Google will only let you do this once, so if you lose it, you won't be able to get it back.
3. Share your spreadsheet (the one you just created) with the email address given in the downloaded JSON.
4. Make note of the client email, the private key, and the spreadsheet ID.

### Setting Credentials for Running Locally

1. Create a file in the bin/ folder and name it `credentials`. 
2. Add the following to credentials: 

```
export ORG_NAME=<slack organization name (from login URL)>
export HUBOT_SLACK_TOKEN=<hubot token from Slack>
export SHEET_ID=<id from your timesheet>
export CLIENT_EMAIL=<client_email from your Service Auth JSON>
export PRIVATE_KEY=<private_key from your Service Auth JSON>
export ADMINS=<space separated list of Slack admins>
export LOG_LEVEL=<preferred logging level of debug/info/warn/error>
```

Note: This file is not under source control. In order to use Ibizan with Heroku, you must set environment variables manually using the Heroku Toolbelt. 

## Deploying to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Make note of the app name and FQDN, because you'll need them in the next section. After this deploys correctly, you'll need to set the following environment variables, if available (some may not be until adding your Hubot to Slack below):

```
ORG_NAME = <slack organization name (from login URL)>
HUBOT_SLACK_TOKEN = <hubot token from Slack>
SHEET_ID = <id from your timesheet>
CLIENT_EMAIL = <client_email from your Service Auth JSON>
PRIVATE_KEY = <private_key from your Service Auth JSON>
ADMINS = <space separated list of Slack admins>
LOG_LEVEL = <preferred logging level of debug/info/warn/error>
```

### Add Hubot to Slack

1. Go to your Slack team's app management page. You may need admin access for this step.
2. Add a Hubot as an integration and fill in the details. Make note of the Slack token, which you'll need in the next section.
3. Fill in the tokens you previously noted into the appropriate configuration variables in Heroku.

If Ibizan doesn't automatically start after you finish setting all the environment variables, use the Heroku Toolbelt to run `heroku restart --app={YOUR APP NAME}` in the terminal.
