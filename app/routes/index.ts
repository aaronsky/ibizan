
import * as express from 'express';
import * as moment from 'moment';

export function applyRoutes(webserver: express.Application, controller: botkit.Controller) {
    // controller.createWebhookEndpoints(webserver);
    // TODO: Why does the express @types declaration not have any props on Request and Response
    controller.createOauthEndpoints(webserver, (err: Error, req: express.Request, res: express.Response) => {
        if (err) {
            res.status(500).send('ERROR: ' + err);
            return;
        }
        res.send('Success!');
    });

    webserver.get('/', (req: express.Request, res: express.Response) => {
        res.json({
            name: process.env.ORG_NAME + '\'s Ibizan',
            version: process.env.npm_package_version,
            time: moment().format()
        });
    });

    return webserver;
}