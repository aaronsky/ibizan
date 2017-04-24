
const moment = require('moment');
const { createIbizanConfig } = require('../../app/config');

const mockIbizanConfig = {
    port: "8080",
    storageUri: "",

    slackClientId: "",
    slackClientSecret: ""
};
const mockTeamConfig = {
    name: 'test team',
    google: {
        sheetId: 'test',
    },
    payroll: {
        referenceDate: moment(),
        period: 2
    }
}

module.exports = {
    ibizan: createIbizanConfig(null, null, mockIbizanConfig),
    team: mockTeamConfig
};