import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ApiGatewayV2WebSocketWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/ApiGateway';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, apigw:any) {
        super(scope, id);
        let region = apigw.ResourceARN.split(':')[3];
        const traffic = new GraphWidget({
            title: 'Message Count '+apigw.apiid + ' (WS)',
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'MessageCount',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SAMPLE_COUNT,
                period:Duration.minutes(1)
            })],
            right: [new Metric({
                namespace: this.namespace,
                metricName: 'ConnectionCount',
                dimensionsMap:{
                    ApiId: apigw.apiid
                }
            })],
            width: 6
        })
        const errors = new GraphWidget({
            title: 'Errors/Latency '+apigw.apiid + '(WS)',
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ClientError',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'IntegrationError',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'ExecutionError',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
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
        return this.widgetSet;
    }

}
