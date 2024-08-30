import {IWidgetSet, WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Stats, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class WafV2WidgetSet extends WidgetSet implements IWidgetSet{
    namespace:string = 'AWS/WAFV2';
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};


    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        const webacl = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length-2];
        const webaclid = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length-1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### WebACL [${webacl}](https://us-east-1.console.aws.amazon.com/wafv2/homev2/web-acl/${webacl}/${webaclid}/overview?region=${region})`
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const BlockedMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BlockedRequests',
            dimensionsMap: {
                WebACL: webacl,
                Region: region,
                Rule: 'ALL'
            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const blockedWidget = new GraphWidget({
            title: `Blocked Requests ALL ${webacl}`,
            region: region,
            left: [BlockedMetric],
            width: 12
        })

        const AllowedMetric = new Metric({
            namespace: this.namespace,
            metricName: 'AllowedRequests',
            dimensionsMap:{
                WebACL: webacl,
                Region: region,
                Rule: 'ALL'
            }
        });

        const allowedWidget = new GraphWidget({
            title: `Allowed Requests ALL ${webacl}`,
            region: region,
            left: [AllowedMetric],
            width: 12
        });

        this.addWidgetRow(blockedWidget,allowedWidget);
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }



}