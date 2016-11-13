
export function applyRoutes(webserver: Express.Application, controller: botkit.Controller) {
    // controller.createWebhookEndpoints(webserver);
    controller.createOauthEndpoints(webserver, (err, req, res) => {
        if (err) {
            res.status(500).send('ERROR: ' + err);
            return;
        }
        res.send('Success!');
    });

    // webserver.get('/', (req, res) => {
    //     res.json({
    //         name: process.env.ORG_NAME + '\'s Ibizan',
    //         version: process.env.npm_package_version,
    //         time: moment().format()
    //     });
    // });

    return webserver;
}