
export function applyRoutes(webserver: Express.Application, controller: botkit.Controller) {
    controller.createWebhookEndpoints(webserver);
    controller.createOauthEndpoints(webserver, (err, req, res) => {
        if (err) {
            res.status(500).send('ERROR: ' + err);
            return;
        }
        res.send('Success!');
    });

    return webserver;
}