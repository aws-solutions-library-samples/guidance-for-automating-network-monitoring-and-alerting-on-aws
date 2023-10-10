import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ApiGatewayV2HttpWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/ApiGateway';
    widgetSet:any = [];
    alarmSet:any = [];

    config:any = {};

    constructor(scope: Construct, id:string, apigw:any, config:any) {
        super(scope,id);
        this.config = config;
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

        const status4xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '4XX',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const status5xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '5XX',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const latencyMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Latency',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.AVERAGE,
            period:Duration.minutes(1)
        });

        const integrationLatencyMetric = new Metric({
            namespace: this.namespace,
            metricName: 'IntegrationLatency',
            dimensionsMap: {
                ApiId: apigw.apiid
            },
            statistic: Statistic.AVERAGE,
            period:Duration.minutes(1)
        });

        const errors = new GraphWidget({
            title: 'Errors/Latency '+apigw.apiid + ' (HTTP)',
            stacked: true,
            region: region,
            left: [status4xxMetric,status5xxMetric],
            right:[latencyMetric,integrationLatencyMetric],
            width: 18
        });

        const status5xxAlarm = status5xxMetric.createAlarm(this, `5xxAlarm-${apigw.apiid}-${region}-${this.config.BaseName}`,{
            alarmName: `5xxAlarm-${apigw.apiid}-${region}-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            threshold: 10,
            evaluationPeriods: 3,
            treatMissingData: TreatMissingData.MISSING
        });

        this.widgetSet.push(new Row(traffic,errors));
        this.alarmSet.push(status5xxAlarm);

    }



    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
