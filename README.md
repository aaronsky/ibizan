# [![Ibizan](https://raw.githubusercontent.com/aaronsky/ibizan/master/docs/ibizan.svg)](http://skyaaron.com/ibizan)

> 🐕-themed employee 🕑-tracking bot for Slack

[![Build Status](https://travis-ci.org/aaronsky/ibizan.svg?branch=master)](https://travis-ci.org/ibizan/ibizan) [![Coverage Status](https://coveralls.io/repos/github/aaronsky/ibizan/badge.svg?branch=master)](https://coveralls.io/github/aaronsky/ibizan?branch=master) [![Gratipay Team](https://img.shields.io/gratipay/team/shields.svg?maxAge=2592000)](https://gratipay.com/ibizan/)

Ibizan is a Slack bot built on the [Botkit](https://github.com/howdyai/botkit) framework, originally contracted by [Fangamer](http://fangamer.com/). Ibizan is designed to provide an intuitive and interactive interface to managing a timesheet.

## Setup

This version of Ibizan is ready to be deployed to your Heroku with a little bit of setup. Future versions will be served as a Slack app, so consider the amount of control you want with this bot when using this method.

You must set up your configuration before running Ibizan or else it will not start.

### Google Sheets Spreadsheet

In its current form, Ibizan punch functionality is tightly coupled to the layout of the spreadsheet it pulls from.

1. Make a copy of [this spreadsheet](https://docs.google.com/spreadsheets/d/1FcCouoPtkNO1Q3Uhbcbg7xy8Im1d_yXBt9CCHg3aaps/edit?usp=sharing).
2. Fill in all the relevant values in the "Variables" worksheet
3. Add rows for each of your employees in "Users"
4. Add a row for each name you want Ibizan to consider a project in "Projects". These are designed to correlate to channel names in Slack, but they don't have to.

### Google Drive API Service Account

1. Follow the instructions [here](https://developers.google.com/identity/protocols/OAuth2ServiceAccount)
2. When given the opportunity to download your keys, download it as JSON and save it somewhere safe. Google will only let you do this once, so if you lose it, you won't be able to get it back.
3. Share your spreadsheet (the one you just created) with the email address given in the downloaded JSON.
4. Make note of the client email, the private key, and the spreadsheet ID.

## Deploying to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Click the button above to automatically deploy an Ibizan to Heroku. Make note of the app name and FQDN, because you'll need them in the next section. 

After deploying to Heroku, you'll need to set the following environment variables:

```
IBIZAN_PORT = <port to run the server from>
IBIZAN_STORAGE_URI = <url to a firebase instance for database>
IBIZAN_SLACK_CLIENT_ID = <slack app client id>
IBIZAN_SLACK_CLIENT_SECRET = <slack app client secret key>
IBIZAN_SLACK_VERIFICATION_TOKEN = <slack app verificiation token>
IBIZAN_GOOGLE_CLIENT_EMAIL = <client_email from your Google Service Auth JSON>
IBIZAN_GOOGLE_PRIVATE_KEY = <private_key from your Google Service Auth JSON>
```

If Ibizan doesn't automatically start after you finish setting all the environment variables, use the Heroku Toolbelt to run `heroku restart --app={YOUR APP NAME}` in the terminal.
