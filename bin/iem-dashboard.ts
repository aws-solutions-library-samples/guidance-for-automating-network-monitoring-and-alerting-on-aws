#!/usr/bin/env node
import 'source-map-support/register';
import {App} from 'aws-cdk-lib';
import { IemDashboardStack } from '../lib/iem-dashboard-stack';

const app = new App();
new IemDashboardStack(app, 'IemDashboardStack');
