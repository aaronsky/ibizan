regex =
  ibizan:                 /(?:@)?ibizan(?::)? ?/i
  modes:                  /(in|out|vacation|sick|unpaid)/i
  rel_time:               /(half-day|(half day)|noon|midnight|([0-9]+(?:\.+[0-9]*)?) hours)/i
  twelvetime:             /\b([1-9]|1[0-2]):?(?:[0-5][0-9])? ?(?:a(m)?|p(m)?)?\b/i
  twentyfourtime:         /\b([01]?[0-9]|2[0-3]):([0-5][0-9])/i
  months:                 /\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?|Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?|Feb(?:ruary)?)\b/i
  date:                   /(\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?) (?:3[01]|[0-2]*[0-9])(?: ?- ?(3[01]|[0-2]*[0-9]))?\b)|(\b(?:Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?) (?:30|[0-2]*[0-9])(?: ?- ?(30|[0-2]*[0-9]))?\b)|(\b(?:Feb(?:ruary)?) (?:29|[0-2]*[0-8])(?: ?- ?(29|[0-2]*[0-8]))?\b)/i

Object.freeze regex

cellHeaders =
  variables:
    vacation:            'vacationhoursforsalariedemployees'
    sick:                'sickhoursforsalariedemployees'
    clockChannel:        'timeloggingchannel'
    exemptChannels:      'houndingchannelexemptions'
    holidays:            'workholidays'
    holidayDate:         'date'
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
    id:                  'punchno.'
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



module.exports = 
  HEADERS: cellHeaders
  REGEX: regex
