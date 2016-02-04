# Every morning, reset hound status for each users


# Ibizan will export a Payroll Report every other Sunday night. 
#   See the ‘Payroll Reports’ tab on the Ibizan spreadsheet. 
#   Most columns will be simple sums of each employee’s logged hours, but 
#   two columns will require special calculations:
#     Paid Hours:
#       If Employee is Salary: =(80 - Unpaid hours)
#       If Employee is Non-Salary:  =(Logged Hours + Vacation Hours + Sick Hours)
#     Overtime Hours: =max(0, Logged Hours - 80)

# Ibizan will DM an employee as soon as they’ve posted in Slack after more than 3 hours of inactivity.
#   If the user is logged out, the DM should say: Check in if you’re on the clock~
#   If the user is logged in, the DM should say: Don’t forget to check out~

# If the user DM’s Ibizan with a non-supported command, it should respond with a list of commands.
# Ibizan should reference Work Holidays from the ‘Variables’ tab on the Ibizan spreadsheet
# Ibizan should not treat weekends or Work Holidays as business days. So if a user says they’re on vacation from Thursday, Jan 14 to Monday, Jan 18, Ibizan will only count three days of vacation against their total (instead of 5).
# Ibizan should reference the list of employees from the ‘Employees’ tab on the Ibizan spreadsheet. Slack users not on the employees list should not be addressed or allowed to use the service.
# Ibizan should recognize ‘noon’ and ‘midnight’ interchangeably with 12:00 / 24:00.
# Ibizan should only accept check-ins, check-outs, and time logs in the ‘Time Logging Channel’ specified in the ‘Variables’ tab on the Ibizan spreadsheet. Ibizan should not accept logging attempts via DM or any other Slack channel.
# Weeks ‘start’ on Sunday morning.
# Users cannot check in yesterday – users may only check out yesterday (and they must give a time, of course)
# Users will only be able to submit entries for the previous 7 days on a rolling basis. So if it’s Tuesday Jan 26, the user will only be able to submit time entries through the previous Tuesday Jan 19 – if they try to submit time for Monday Jan 18 they will recieve an error.
# Users should receive a DM “chime” every other Friday afternoon to inform them that payroll runs on Monday, and that unaccounted-for time will not be paid.
# If a user gives a time but doesn’t specify ‘am’ or ‘pm’, Ibizan must make an assumption based on the given context. If the user is checking in, anything between 6:00-12:00 is assumed to be morning (12:00 = noon). If the user is checking out, anything between 12:01-9:00 is assumed to be pm.
# Once an employee is checked ‘in’, they must check ‘out’ before they can check ‘in’ again (to avoid people forgetting to clock out the night before).
# When given a command, Ibizan should always responds (in the channel) to confirm. When checking out or logging blocks of time, the entry should be read back along with the latest totals. e.g. 3.25 hours logged today / Today’s total: 5.5 hours / Week total: 40 hours
# Users have the option to say undo to cancel the last command.
