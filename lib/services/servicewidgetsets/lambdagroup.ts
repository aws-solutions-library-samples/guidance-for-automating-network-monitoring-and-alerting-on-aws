import {WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {Duration} from "aws-cdk-lib";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {SnsAction} from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";

export class LambdaGroupWidgetSet extends Construct implements WidgetSet {
    namespace: string = 'AWS/Lambda';
    widgetSet: any = [];
    alarmSet: any = [];
    config:any = {};

    constructor(scope:Construct, id:string, resourceArray:any, config:any) {
        super(scope,id);
        this.config = config;
        const region = resourceArray[0].ResourceARN.split(':')[3];
        let widgetHeight = 8
        if ( resourceArray.length > 5 ){
            widgetHeight = 14
        }

        this.widgetSet.push(new TextWidget({
            markdown: "**Lambdas in " + region +' ' + id + '**',
            width: 24,
            height: 1
        }));

        const invocationsMetricArray = this.getMetricArray(resourceArray,'Invocations');
        const durationMetricArray = this.getMetricArray(resourceArray,'Duration',Duration.minutes(1),Statistic.AVERAGE);

        const errorsMetricArray = this.getMetricArray(resourceArray,'Errors');
        for (const metric of errorsMetricArray) {
            if ( metric.dimensions && metric.dimensions.FunctionName ){

                let alarm = metric.createAlarm(this,`Errors-${metric.dimensions.FunctionName}-${region}-${this.config.BaseName}`,{
                    alarmName: `Errors-${metric.dimensions.FunctionName}-${region}-${this.config.BaseName}`,
                    datapointsToAlarm: 3,
                    evaluationPeriods: 3,
                    threshold: 10
                });
                if ( config.AlarmTopic ){
                    alarm.addAlarmAction(new SnsAction(sns.Topic.fromTopicArn(this,`ALARMTOPIC-${metric.dimensions.FunctionName}`,config.AlarmTopic)));
                }
                this.alarmSet.push(alarm);
            }
        }


        const throttlesMetricArray = this.getMetricArray(resourceArray,'Throttles');
        for (const metric of throttlesMetricArray) {
            if ( metric.dimensions && metric.dimensions.FunctionName ){

                let alarm = metric.createAlarm(this,`Throttles-${metric.dimensions.FunctionName}-${region}-${this.config.BaseName}`,{
                    alarmName: `Throttles-${metric.dimensions.FunctionName}-${region}-${this.config.BaseName}`,
                    datapointsToAlarm: 3,
                    evaluationPeriods: 3,
                    threshold: 10
                });
                if ( config.AlarmTopic ){
                    alarm.addAlarmAction(new SnsAction(sns.Topic.fromTopicArn(this,`ALARMTOPIC-${metric.dimensions.FunctionName}-${metric.metricName}`,config.AlarmTopic)));
                }
                this.alarmSet.push(alarm);

            }
        }

        const concurrentMetricArray = this.getMetricArray(resourceArray,'ConcurrentExecutions',Duration.minutes(1),Statistic.MAXIMUM);


        const invocationsDuration = new GraphWidget({
            title: 'Invocations/Duration',
            region: region,
            left: invocationsMetricArray,
            right: durationMetricArray,
            width: 8,
            height: widgetHeight
        });

        const errorsThrottles = new GraphWidget({
            title: 'Errors/Throttles',
            region: region,
            left: errorsMetricArray,
            right: throttlesMetricArray,
            width: 8,
            height: widgetHeight
        });

        const concurrency = new GraphWidget({
            title: 'Concurrency',
            region: region,
            left: concurrentMetricArray,
            width: 8,
            height: widgetHeight
        });

        this.widgetSet.push(new Row(invocationsDuration,errorsThrottles,concurrency));

    }

    private getMetricArray(lambdas:any,metric:string,period?:Duration,statistic?:Statistic){
        let metricArray:Metric[] = [];
        let metricPeriod = Duration.minutes(1);
        let metricStatistic = Statistic.SUM
        if ( period ){
            metricPeriod = period;
        }
        if ( statistic ){
            metricStatistic = statistic;
        }
        for (let lambda of lambdas){
            const functionName = lambda.ResourceARN.split(':')[lambda.ResourceARN.split(':').length - 1];
            metricArray.push(new Metric({
                namespace: this.namespace,
                metricName: metric,
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: metricStatistic,
                period:metricPeriod
            }));
        }
        return metricArray;
    }


    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }


}