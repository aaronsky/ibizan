
const { Config } = require('../../app/config');

const mockConfig = {
    name: "Extreme Dog",
    port: "8080",
    storageUri: "",

    slackClientId: "",
    slackClientSecret: "",

    googleSheetId: "test",
    googleClientEmail: "",
    googlePrivateKey: ""
};

module.exports = new Config(mockConfig);