
var mockRobot = {
  adapter: {
    client: {
      _apiCall: function (method, params, cb) {
        console.log (method + ' with params ' + JSON.stringify(params));
        cb({response:'ok'});
      }
    }
  },
  send: function (params, msg) {
    console.log(msg + ' with params ' + JSON.stringify(params));
  }
};

module.exports = mockRobot;
