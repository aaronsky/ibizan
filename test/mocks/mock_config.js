
const { ConfigFactory } = require('../../app/config');

const mockIbizanConfig = {
    port: "8080",
    storageUri: "",

    slackClientId: "",
    slackClientSecret: ""
};
const mockTeamConfig = {
    name: 'test team',
    admins: ['aaronsky', 'briancoia'],
    google: {
        sheetId: 'test',
        clientEmail: 'bad@email.com',
        privateKey: 'BAD KEY'
    }
}

module.exports = {
    ibizan: ConfigFactory.loadConfiguration(null, null, mockIbizanConfig),
    team: mockTeamConfig
};