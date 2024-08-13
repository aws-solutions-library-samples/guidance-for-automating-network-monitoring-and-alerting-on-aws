#!/usr/bin/env node
import 'source-map-support/register';
import {App} from 'aws-cdk-lib';
import { IemDashboardStack } from '../lib/iem-dashboard-stack';
import {AlarmDashboardStack} from "../lib/alarm-dashboard-stack";
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';
import config from '../lib/config.json';


if ( config.AlarmDashboard?.enabled && (!config.AlarmDashboard.organizationId || !config.AlarmDashboard.organizationId.startsWith("o-") ) ){
    throw new Error('Please edit `lib/config.json` and add `organizationId` before continuing');
}


const app = new App();

Aspects.of(app).add(new AwsSolutionsChecks({verbose: true}));

if ( config.MetricDashboards && ! config.MetricDashboards.enabled ){
    console.log('Not deploying metric dashboards');
} else {
    new IemDashboardStack(app, `${config.BaseName}-Stack`);
}

if ( config.AlarmDashboard && config.AlarmDashboard.enabled ){
    new AlarmDashboardStack(app,`${config.BaseName}-Alarm-Stack`);
} else {
    console.log('Not deploying AlarmDashboard');
}