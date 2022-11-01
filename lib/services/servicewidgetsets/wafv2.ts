import {WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class WafV2WidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/WAFV2';
    widgetSet:any = [];
    alarmSet:any = [];


    constructor(scope: Construct, id: string, resource:any) {
        super(scope, id);
        const webacl = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length-2];
        const webaclid = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length-1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### WebACL [${webacl}](https://us-east-1.console.aws.amazon.com/wafv2/homev2/web-acl/${webacl}/${webaclid}/overview?region=${region})`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 2
        }));

        const BlockedMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BlockedRequests',
            dimensionsMap: {
                WebACL: webacl,
                Region: region,
                Rule: 'ALL'
            },
            statistic: Statistic.SUM,
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

        this.widgetSet.push(new Row(blockedWidget,allowedWidget));
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }



}