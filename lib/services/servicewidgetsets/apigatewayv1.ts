import {WidgetSet} from "./widgetset";
import {
    GraphWidget,
    MathExpression,
    Metric,
    Row,
    Statistic,
    TextWidget,
    TreatMissingData
} from "aws-cdk-lib/aws-cloudwatch";
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

        let hasCachingEnabled = false;
        let markDown = `### API GW [${apigw}](https://${region}.console.aws.amazon.com/apigateway/home?region=${region}#/apis/${apiid}/resources)`
        if ( resource.stages ){
            let stages:[any] = resource.stages;
            markDown += ` Stages: |`
            for ( let stage of stages ){
                markDown += ` [${stage.stageName}](https://${region}.console.aws.amazon.com/apigateway/home?region=${region}#/apis/${apiid}/stages/${stage.stageName})`;
                if ( stage.cacheClusterEnabled && stage.cacheClusterEnabled == true ){
                    markDown += `(**cached**)`
                    hasCachingEnabled = true;
                }
                markDown += ` |`
            }

        }

        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

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
            width: hasCachingEnabled?9:18
        });

        if ( hasCachingEnabled ){
            const hitMetric = new Metric({
                namespace: this.namespace,
                metricName: 'CacheHitCount',
                dimensionsMap: {
                    ApiName: apigw
                },
                statistic: Statistic.SUM,
                period: Duration.minutes(1)
            });

            const missMetric = new Metric({
                namespace: this.namespace,
                metricName: 'CacheMissCount',
                dimensionsMap: {
                    ApiName: apigw
                },
                statistic: Statistic.SUM,
                period: Duration.minutes(1)
            });

            const missPercentage = new MathExpression({
                expression: "(missMetric/hitMetric) * 100",
                usingMetrics: {
                    missMetric: missMetric,
                    hitMetric: hitMetric
                },
                label: "Miss ratio in %"
            });

            const missAlarm = missPercentage.createAlarm(this,`CacheMissAlarm-${apiid}-${region}`,{
                alarmName:`CacheMissAlarm-${apiid}-${region}`,
                datapointsToAlarm: 5,
                evaluationPeriods: 5,
                threshold: 25,
                treatMissingData: TreatMissingData.NOT_BREACHING
            });

            this.alarmSet.push(missAlarm);

            const cacheInfo = new GraphWidget({
                title: 'CacheHit/CacheMiss',
                stacked: true,
                region: region,
                left: [missPercentage],
                leftYAxis:{
                    min: 0,
                    max: 100
                },
                width: 9
            });
            this.widgetSet.push(new Row(traffic,cacheInfo,errors));
        } else {
            this.widgetSet.push(new Row(traffic,errors));
        }


    }



    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

}
