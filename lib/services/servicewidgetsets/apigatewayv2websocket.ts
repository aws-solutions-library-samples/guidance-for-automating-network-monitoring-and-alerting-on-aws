import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ApiGatewayV2WebSocketWidgetSet extends Construct implements IWidgetSet{
    namespace:string = 'AWS/ApiGateway';
    widgetSet:any = [];
    alarmSet:any = [];

    config:any = {};

    constructor(scope: Construct, id: string, apigw:any, config:any) {
        super(scope, id);
        this.config = config;
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
        const clientError = new Metric({
                namespace: this.namespace,
                metricName: 'ClientError',
                dimensionsMap: {
                    ApiId: apigw.apiid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            });

        const integrationError = new Metric({
            namespace: this.namespace,
            metricName: 'IntegrationError',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const executionError = new Metric({
            namespace: this.namespace,
            metricName: 'ExecutionError',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.AVERAGE,
            period:Duration.minutes(1)
        });

        const integrationLatency = new Metric({
            namespace: this.namespace,
            metricName: 'IntegrationLatency',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.AVERAGE,
            period:Duration.minutes(1)
        });

        const errors = new GraphWidget({
            title: 'Errors/Latency '+apigw.apiid + '(WS)',
            stacked: true,
            region: region,
            left: [clientError,integrationError,executionError],
            right:[integrationLatency],
            width: 18
        });

        const integrationErrorAlarm = integrationError.createAlarm(this,`IntegrationErrorAlarm-${apigw.apiid}-${region}-${this.config.BaseName}`,{
            alarmName: `IntegrationErrorAlarm-${apigw.apiid}-${region}-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            threshold: 10,
            evaluationPeriods: 3,
            treatMissingData: TreatMissingData.MISSING
        })

        this.widgetSet.push(new Row(traffic,errors));
        this.alarmSet.push(integrationErrorAlarm);
    }



    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.widgetSet;
    }

}
