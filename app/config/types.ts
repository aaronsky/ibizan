import * as moment from 'moment';

export interface IbizanConfig {
    port: number;
    storageUri: string;
    slack: {
        clientId: string;
        clientSecret: string;
        verificationToken: string;
        scopes: string[];
    },
    googleCredentials: string
}

export interface TeamConfig {
    name: string;
    retry?: boolean | number;
    google: {
        sheetId: string;
    }
    payroll: {
        referenceDate: moment.Moment;
        period: number;
    }
}

export interface PayrollConfig {
    referenceDate: moment.Moment;
    period: number;
}