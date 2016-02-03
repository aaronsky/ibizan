regex =
  rel_time:/(half-day|(half day)|([0-9]+\.+[0-9]*) hours)/i
  time:/([0-1][0-9]|[2][0-3])+:+[0-5][0-9]/i
  date:/(\b(?:Jan(?:uary)?|Mar(?:ch)?|May|Jul(?:y)?|Aug(?:ust)?|Oct(?:ober)?|Dec(?:ember)?) (?:[0-2]*[0-9]|3[01])\b)|(\b(?:Sep(?:tember)?|Apr(?:il)?|Jun(?:e)?|Nov(?:ember)?) (?:[0-2]*[0-9]|30)\b)|(\b(?:Feb(?:ruary)?) (?:[0-2]*[0-8]|29)\b)/i

cellHeaders =
  variables:
    vacation:'vacationhoursforsalariedemployees'
    sick:'sickhoursforsalariedemployees'
    clockChannel:'timeloggingchannel'
    exemptChannels:'houndingchannelexemptions'
    holidays:'workholidays'
    holidayDate:'date'
  projects:
    name:'project'
    start:'weekstarting'
    total:'totalofhours'
  users:
    slackname:'slackusername'
    name:'employeename'
    salary:'salary'
    start:'activehoursbegin'
    end:'activehoursend'
    timezone:'timezone'
    vacationAvailable:'totalvacationdaysavailable'
    vacationLogged:'totalvacationdayslogged'
    sickAvailable:'totalsickdaysavailable'
    sickLogged:'totalsickdayslogged'
    unpaidLogged:'totalunpaiddayslogged'
    overtime:'totalovertime'
    totalLogged:'totalloggedhours'
    averageLogged:'averagehoursloggedweek'

module.exports = 
  HEADERS: cellHeaders
  REGEX: regex
