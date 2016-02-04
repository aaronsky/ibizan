# Ibizan
_Dog-themed Employee Time Tracking Slack Bot_

Ibizan is a chat bot built on the [Hubot][hubot] framework, contracted by Fangamer. Ibizan is dedicated to providing an intuitive and interactive interface to managing a timesheet.

## Running ibizan Locally

After cloning the repo and setting the created folder to your current directory, you can test Ibizan hubot by running the following command:

    ./bin/hubot -a slack

This will install dependencies and run the bot. However, it will not work without setting up your configuration (below).

## Configuration

You must set up your configuration before running Ibizan or else it will not start.

### Hubot Slack Token

    HUBOT_SLACK_TOKEN=<your token>

### Google Sheets Spreadsheet

In its current form, Ibizan punch functionality is tightly coupled to the layout of the spreadsheet it pulls from. This will be addressed in future versions.

Create a spreadsheet on Google Sheets that has the following layout:

#### Worksheet 1
* Name - Payroll Reports
* Column Headers:
  * Payroll Date (Date) - MM/DD/yyyy
  * Employee Name (String)
  * Paid Hours (Number)
  * Unpaid Hours (Number)
  * Logged Hours (Number)
  * Vacation Hours (Number)
  * Sick Hours (Number)
  * Overtime Hours (Number)
  * Holiday Hours (Number)
* Note: The contents of this sheet are auto-generated, but the headers are not.

#### Worksheet 2
* Name - Payroll Reports
* Column Headers:
  * Payroll Date (Date) - MM/DD/yyyy
  * Employee Name (String)
  * Paid Hours (Number)
  * Unpaid Hours (Number)
  * Logged Hours (Number)
  * Vacation Hours (Number)
  * Sick Hours (Number)
  * Overtime Hours (Number)
  * Holiday Hours (Number)
* Note: The contents of this sheet are auto-generated, but the headers are not.

#### Worksheet 3
* Name - Payroll Reports
* Column Headers:
  * Payroll Date (Date) - MM/DD/yyyy
  * Employee Name (String)
  * Paid Hours (Number)
  * Unpaid Hours (Number)
  * Logged Hours (Number)
  * Vacation Hours (Number)
  * Sick Hours (Number)
  * Overtime Hours (Number)
  * Holiday Hours (Number)
* Note: The contents of this sheet are auto-generated, but the headers are not.

#### Worksheet 4
* Name - Payroll Reports
* Column Headers:
  * Payroll Date - [Date] - MM/DD/yyyy
  * Employee Name (String)
  * Paid Hours (Number)
  * Unpaid Hours (Number)
  * Logged Hours (Number)
  * Vacation Hours (Number)
  * Sick Hours (Number)
  * Overtime Hours (Number)
  * Holiday Hours (Number)
* Note: The contents of this sheet are auto-generated, but the headers are not.

#### Worksheet 5
* Name - Payroll Reports
* Column Headers:
  * Vacation Hours (for Salaried Employees)
  * Sick Hours (for Salaried Employees)
  * Time Logging Channel
  * Hounding Channel
  * Exemptions
  * Work Holidays
  * Date 
* Note: The contents of this sheet are auto-generated, but the headers are not.

### Google Drive API Service Account

1. Follow the instructions [here](https://developers.google.com/identity/protocols/OAuth2ServiceAccount)
2. When given the opportunity to download your keys (you only can do this once), download it as JSON and save it in the config/ folder. You may need to create this folder.
3. Share your spreadsheet (the one you created before) with the email address given in the downloaded JSON.

### Usage

## Advanced Usage

It is also possible to define `external-scripts.json` as an object to
explicitly specify which scripts from a package should be included. The example
below, for example, will only activate two of the six available scripts inside
the `hubot-fun` plugin, but all four of those in `hubot-auto-deploy`.

```json
{
  "hubot-fun": [
    "crazy",
    "thanks"
  ],
  "hubot-auto-deploy": "*"
}
```

**Be aware that not all plugins support this usage and will typically fallback
to including all scripts.**

[npmjs]: https://www.npmjs.com

### hubot-scripts

Before hubot plugin packages were adopted, most plugins were held in the
[hubot-scripts][hubot-scripts] package. Some of these plugins have yet to be
migrated to their own packages. They can still be used but the setup is a bit
different.

To enable scripts from the hubot-scripts package, add the script name with
extension as a double quoted string to the `hubot-scripts.json` file in this
repo.

[hubot-scripts]: https://github.com/github/hubot-scripts

##  Persistence

If you are going to use the `hubot-redis-brain` package (strongly suggested),
you will need to add the Redis to Go addon on Heroku which requires a verified
account or you can create an account at [Redis to Go][redistogo] and manually
set the `REDISTOGO_URL` variable.

    % heroku config:add REDISTOGO_URL="..."

If you don't need any persistence feel free to remove the `hubot-redis-brain`
from `external-scripts.json` and you don't need to worry about redis at all.

[redistogo]: https://redistogo.com/

## Adapters

Adapters are the interface to the service you want your hubot to run on, such
as Campfire or IRC. There are a number of third party adapters that the
community have contributed. Check [Hubot Adapters][hubot-adapters] for the
available ones.

If you would like to run a non-Campfire or shell adapter you will need to add
the adapter package as a dependency to the `package.json` file in the
`dependencies` section.

Once you've added the dependency with `npm install --save` to install it you
can then run hubot with the adapter.

    % bin/hubot -a <adapter>

Where `<adapter>` is the name of your adapter without the `hubot-` prefix.

[hubot-adapters]: https://github.com/github/hubot/blob/master/docs/adapters.md

## Deployment

    % heroku create --stack cedar
    % git push heroku master

If your Heroku account has been verified you can run the following to enable
and add the Redis to Go addon to your app.

    % heroku addons:add redistogo:nano

If you run into any problems, checkout Heroku's [docs][heroku-node-docs].

You'll need to edit the `Procfile` to set the name of your hubot.

More detailed documentation can be found on the [deploying hubot onto
Heroku][deploy-heroku] wiki page.

### Deploying to UNIX or Windows

If you would like to deploy to either a UNIX operating system or Windows.
Please check out the [deploying hubot onto UNIX][deploy-unix] and [deploying
hubot onto Windows][deploy-windows] wiki pages.

[heroku-node-docs]: http://devcenter.heroku.com/articles/node-js
[deploy-heroku]: https://github.com/github/hubot/blob/master/docs/deploying/heroku.md
[deploy-unix]: https://github.com/github/hubot/blob/master/docs/deploying/unix.md
[deploy-windows]: https://github.com/github/hubot/blob/master/docs/deploying/unix.md

## Campfire Variables

If you are using the Campfire adapter you will need to set some environment
variables. If not, refer to your adapter documentation for how to configure it,
links to the adapters can be found on [Hubot Adapters][hubot-adapters].

Create a separate Campfire user for your bot and get their token from the web
UI.

    % heroku config:add HUBOT_CAMPFIRE_TOKEN="..."

Get the numeric IDs of the rooms you want the bot to join, comma delimited. If
you want the bot to connect to `https://mysubdomain.campfirenow.com/room/42`
and `https://mysubdomain.campfirenow.com/room/1024` then you'd add it like
this:

    % heroku config:add HUBOT_CAMPFIRE_ROOMS="42,1024"

Add the subdomain hubot should connect to. If you web URL looks like
`http://mysubdomain.campfirenow.com` then you'd add it like this:

    % heroku config:add HUBOT_CAMPFIRE_ACCOUNT="mysubdomain"

[hubot-adapters]: https://github.com/github/hubot/blob/master/docs/adapters.md

## Restart the bot

You may want to get comfortable with `heroku logs` and `heroku restart` if
you're having issues.
