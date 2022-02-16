import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ApiGatewayV2HttpWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/ApiGateway';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id:string, apigw:any) {
        super(scope,id);
        let region = apigw.ResourceARN.split(':')[3];
        const traffic = new GraphWidget({
            title: 'Count '+apigw.apiid + " (HTTP)",
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Count',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SAMPLE_COUNT,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'DataProcessed',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SAMPLE_COUNT,
                period:Duration.minutes(1)
            })],
            width: 6
        })
        const errors = new GraphWidget({
            title: 'Errors/Latency '+apigw.apiid + ' (HTTP)',
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: '4XX',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: '5XX',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Latency',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'IntegrationLatency',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 18
        });
        this.widgetSet.push(new Row(traffic,errors));
    }



    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
