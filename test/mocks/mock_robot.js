
var mockRobot = {
    adapter: {
        client: {
            _apiCall: function (method, params, cb) {
                console.log(method + ' with params ' + JSON.stringify(params));
                cb({ response: 'ok' });
            },
            rtm: {
                dataStore: {
                    getDMByName: function (params, cb) {
                        cb({ id: 'D' })
                    },
                    getChannelGroupOrDMById: function (params, cb) {
                        cb({ name: 'channel' })
                    }
                }
            }
        }
    },
    send: function (params, msg) {
        console.log(msg + ' with params ' + JSON.stringify(params));
    }
};

module.exports = mockRobot;
