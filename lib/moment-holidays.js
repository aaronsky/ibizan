//## Moment.JS Holiday Plugin
//
//Usage:
//  Call .holiday() from any moment object. If date is a US Federal Holiday, name of the holiday will be returned.
//  Otherwise, return nothing.
//
//  Example:
//    `moment('12/25/2013').holiday()` will return "Christmas Day"
//
//Holidays:
//  You can configure holiday bellow. The 'M' stands for Month and represents fixed day holidays.
//  The 'W' stands for Week, and represents holidays with date based on week day rules.
//  Example: '10/2/1' Columbus Day (Second monday of october).
//
//License:
//  Copyright (c) 2013 [Jr. Hames](http://jrham.es) under [MIT License](http://opensource.org/licenses/MIT)
(function() {
  var moment;

  moment = typeof require !== "undefined" && require !== null ? require("moment") : this.moment;

  //Holiday definitions
  var _holidays = {
    'M': { //Month, Day
      '01/01': "New Year's Day",
      '04/01': "RAAHB",
      '07/04': "Independence Day",
      '11/11': "Veteran's Day",
      '12/24': "Christmas Eve",
      '12/25': "Christmas Day",
    },
    'W': { //Month, Week of Month, Day of Week (all zero-based)
      '1/3/1': "Martin Luther King Jr. Day",
      '2/3/1': "Washington's Birthday",
      '5/5/1': "Memorial Day",
      '9/1/1': "Labor Day",
      '11/4/4': "Thanksgiving Day"
    }
  };

  moment.fn.holiday = function() {
    var diff = 1 + (0 | (this._d.getDate() - 1) / 7),
      memorial = (this._d.getDay() === 1 && (this._d.getDate() + 7) > 30) ? "5" : null;

    return (_holidays['M'][this.format('MM/DD')] || 
            _holidays['W'][this.format('M/' + (memorial || diff) + '/d')]);
  };

  moment.fn.fromHolidayString = function(name) {
    for (var key in _holidays['M']) {
      if (_holidays['M'].hasOwnProperty(key)) {
        if (_holidays['M'][key] === name) {
          var comps = key.split('/');
          var year = this.year();
          var month = parseInt(comps[0]) - 1;
          var date = parseInt(comps[1]);
          var newHoliday = moment({
            year: year,
            month: month,
            day: date
          });
          return newHoliday;
        }
      }
    }
    for (var key in _holidays['W']) {
      if (_holidays['W'].hasOwnProperty(key)) {
        if (_holidays['W'][key] === name) {
          var comps = key.split('/');
          var year = this.year();
          var month = parseInt(comps[0]) - 1;
          var newHoliday = moment({
            year: year,
            month: month
          });
          var maxDays = moment({year: year, month: month}).endOf('month').date();
          var week = parseInt(comps[1]);
          if (maxDays < 31) {
            week = week <= 1 ? 1 : week - 1;
          }
          var day = parseInt(comps[2]);
          newHoliday.date(7 * week).day(day);
          return newHoliday;
        }
      }
    }
    return null;
  };

  if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
    module.exports = moment;
  }

}(this));
