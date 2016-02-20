module.exports = (robot) ->
  Organization = require('../models/organization').get()
  
  robot.hear /!list users!/i, (res) ->
    res.send JSON.stringify Organization.users

  robot.hear /!generate report!/i, (res) ->
    Organization.generateReport().done(
      (numberDone) ->
        res.send "Report generated for #{numberDone} employees"
    )

  robot.hear /!reset hound status!/i, (res) ->
    count = Organization.resetHounding()
    res.send "Reset #{count}
               #{if count is 1 then "person's" else "peoples'"}
               hound status"
