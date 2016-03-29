
regex =
  ibizan:          /(?:@)?ibizan(?::)? ?/i
  modes:           /(in|out|vacation|sick|unpaid)/i
  append:          /(append|add)/i
  days:            /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i
  rel_time:        /(half-day|(half day)|noon|midnight|([0-9]+(?:\.+[0-9]*)?) hour(s)?)/i
  time:            /(\b(0?[1-9])|(1[0-2]))(?:(:[0-5][0-9] ?(am?|pm?)?)|(am?|pm?)\b)|((\b([0-1][0-9])|(2[0-3])):([0-5][0-9])\b)/i
  months:          /\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?|Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?|Feb(?:ruary)?)\b/i
  date:            /(\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?) (?:3[01]|[0-2]*[0-9])(?: ?- ?(3[01]|[0-2]*[0-9]))?\b)|(\b(?:Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?) (?:30|[0-2]*[0-9])(?: ?- ?(30|[0-2]*[0-9]))?\b)|(\b(?:Feb(?:ruary)?) (?:29|[0-2]*[0-8])(?: ?- ?(29|[0-2]*[0-8]))?\b)/i
  numdate:         /((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b))(?: ?- ?((?:\b(0?2)\/(0?[1-9]|[1-2][0-9])\b)|(?:\b(0?[469]|11)\/(0?[1-9]|[1-2][1-9]|30)\b)|(?:\b(0?[13578]|(10|12))\/(0?[1-9]|[1-2][1-9]|3[01])\b)))?/i

Object.freeze regex

cellHeaders =
  variables:
    vacation:            'vacationhoursforsalariedemployees'
    sick:                'sickhoursforsalariedemployees'
    clockChannel:        'timeloggingchannel'
    exemptChannels:      'houndingchannelexemptions'
    holidays:            'workholidays'
    holidayOverride:     'date'
  projects:
    name:                'project'
    start:               'weekstarting'
    total:               'totalofhours'
  users:
    slackname:           'slackusername'
    name:                'employeename'
    salary:              'salary'
    start:               'activehoursbegin'
    end:                 'activehoursend'
    timezone:            'timezone'
    vacationAvailable:   'totalvacationdaysavailable'
    vacationLogged:      'totalvacationdayslogged'
    sickAvailable:       'totalsickdaysavailable'
    sickLogged:          'totalsickdayslogged'
    unpaidLogged:        'totalunpaiddayslogged'
    overtime:            'totalovertime'
    totalLogged:         'totalloggedhours'
    averageLogged:       'averagehoursloggedweek'
  rawdata:
    id:                  'punchid'
    today:               'dateentered'
    name:                'employee'
    in:                  'in'
    out:                 'out'
    totalTime:           'elapsedtime'
    blockTime:           'block'
    notes:               'notes'
    project1:            'project1'
    project2:            'project2'
    project3:            'project3'
    project4:            'project4'
    project5:            'project5'
    project6:            'project6'
  payrollreports:
    date:                'payrolldate'
    name:                'employeename'
    paid:                'paidhours'
    unpaid:              'unpaidhours'
    logged:              'loggedhours'
    vacation:            'vacationhours'
    sick:                'sickhours'
    overtime:            'overtimehours'
    holiday:             'holidayhours'

Object.freeze cellHeaders

timezone = 'America/Phoenix'
# Object.freeze timezone

module.exports =
  HEADERS: cellHeaders
  REGEX: regex
  TIMEZONE: timezone
