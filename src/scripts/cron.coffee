Cron = require('node-cron').schedule
every = require 'every-moment'

Organization = require('../models/organization').get()

module.exports = (robot) ->
  # Every morning, reset hound status for each users

  resetHounding = () ->
    users = Organization.users
    for user in users
      user.shouldHound = true


  job = new Cron '00 00 06 * * 1-5',
                 resetHounding,
                 null,
                 true

  # Ibizan will export a Payroll Report every other Sunday night.
  #   See the ‘Payroll Reports’ tab on the Ibizan spreadsheet.
  #   Most columns will be simple sums of each employee’s logged hours, but
  #   two columns will require special calculations:
  #     Paid Hours:
  #       If Employee is Salary: =(80 - Unpaid hours)
  #       If Employee is Non-Salary:  =(Logged Hours + Vacation Hours + Sick Hours)
  #     Overtime Hours: =max(0, Logged Hours - 80)
  every 2, 'weeks', () ->
    console.log 'Time to send the biweekly report!'
    Organization.generateReport()

  # Ibizan should not treat weekends or Work Holidays as business days. So if a user says they’re on vacation from Thursday, Jan 14 to Monday, Jan 18, Ibizan will only count three days of vacation against their total (instead of 5).
  # Ibizan should only accept check-ins, check-outs, and time logs in the ‘Time Logging Channel’ specified in the ‘Variables’ tab on the Ibizan spreadsheet. Ibizan should not accept logging attempts via DM or any other Slack channel.
  # Weeks ‘start’ on Sunday morning.
  # Users should receive a DM “chime” every other Friday afternoon to inform them that payroll runs on Monday, and that unaccounted-for time will not be paid.
  # When given a command, Ibizan should always responds (in the channel) to confirm. When checking out or logging blocks of time, the entry should be read back along with the latest totals. e.g. 3.25 hours logged today / Today’s total: 5.5 hours / Week total: 40 hours
