import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ApiGatewayV1WidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/ApiGateway';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id:string, resource:any) {
        super(scope,id);
        let apigw = resource.name;
        let region = resource.ResourceARN.split(':')[3];
        let apiid = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length-1]
        const trafficMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Count',
            dimensionsMap: {
                ApiName: apigw
            },
            statistic: Statistic.SAMPLE_COUNT,
            period:Duration.minutes(1)
        })

        const traffic = new GraphWidget({
            title: 'Count '+apigw,
            stacked: true,
            region: region,
            left: [trafficMetric],
            width: 6
        })

        const trafficCountAlarm = trafficMetric.createAlarm(this,`TrafficCountAlarm-${apigw}-${apiid}`,{
            alarmName: `Traffic-${apigw}-${apiid}`,
            evaluationPeriods: 1,
            threshold: 10000,
            datapointsToAlarm: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING
        })

        this.alarmSet.push(trafficCountAlarm)

        const status4xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '4XXError'+apigw,
            dimensionsMap: {
                ApiName: apigw
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const status5xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '5XXError'+apigw,
            dimensionsMap: {
                ApiName: apigw
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const error4xxAlarm = status4xxMetric.createAlarm(this, `Error4xxAlarm-${apigw}-${apiid}`,{
            datapointsToAlarm: 1,
            alarmName: `Error4xx-${apigw}-${apiid}`,
            threshold: 1000,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 1
        })

        const error5xxAlarm = status5xxMetric.createAlarm(this,`Error5xxAlarm-${apigw}-${apiid}`,{
            datapointsToAlarm: 1,
            alarmName: `Error5xx-${apigw}-${apiid}`,
            threshold: 1000,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 1
        })

        this.alarmSet.push(error4xxAlarm,error5xxAlarm)

        const errors = new GraphWidget({
            title: 'Errors/Latency '+apigw,
            stacked: true,
            region: region,
            left: [status4xxMetric,status5xxMetric],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Latency',
                dimensionsMap: {
                    ApiName: apigw
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'IntegrationLatency',
                dimensionsMap: {
                    ApiName: apigw
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
