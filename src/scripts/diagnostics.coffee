# Description:
#   Your dog friend makes sure everything's in order
#
# Commands:
#
# Notes:
#
# Author:
#   aaronsky

module.exports = (robot) ->
  Organization = require('../models/organization').get()
  
  # Org statistics

  # list org users
  robot.hear /!list users!/i, (res) ->
    res.send JSON.stringify Organization.users

  # list org projects

  # generate report manually
  robot.hear /!generate report!/i, (res) ->
    Organization.generateReport().done(
      (numberDone) ->
        res.send "Report generated for #{numberDone} employees"
    )

  # reset everyone's hound status manually
  robot.hear /!reset hound status!/i, (res) ->
    count = Organization.resetHounding()
    res.send "Reset #{count}
               #{if count is 1 then "person's" else "peoples'"}
               hound status"

  # manually invoke resync with spreadsheet
  robot.hear /!sync!/i, (res) ->
    Organization.sync()
    .catch((err) -> res.send "Failed to resync.")
    .done((status) ->
      res.send "Re-synced with spreadsheet"
    )