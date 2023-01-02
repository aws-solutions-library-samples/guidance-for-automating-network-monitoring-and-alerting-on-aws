import {WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {Duration} from "aws-cdk-lib";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";

export class LambdaGroupWidgetSet extends Construct implements WidgetSet {
    namespace: string = 'AWS/Lambda';
    widgetSet: any = [];
    alarmSet: any = [];

    constructor(scope:Construct, id:string, resourceArray:any) {
        super(scope,id);
        const region = resourceArray[0].ResourceARN.split(':')[3];

        this.widgetSet.push(new TextWidget({
            markdown: "**Lambdas in " + region +' ' + id + '**',
            width: 24,
            height: 1
        }));

        const invocationsMetricArray = this.getMetricArray(resourceArray,'Invocations');
        const durationMetricArray = this.getMetricArray(resourceArray,'Duration')

        const errorsMetricArray = this.getMetricArray(resourceArray,'Errors');
        const throttlesMetricArray = this.getMetricArray(resourceArray,'Throttles');

        const concurrentMetricArray = this.getMetricArray(resourceArray,'ConcurrentExecutions');

        const invocationsDuration = new GraphWidget({
            title: 'Invocations/Duration',
            region: region,
            left: invocationsMetricArray,
            right: durationMetricArray,
            width: 6,
            height: 8
        });

        const errorsThrottles = new GraphWidget({
            title: 'Errors/Throttles',
            region: region,
            left: errorsMetricArray,
            right: throttlesMetricArray,
            width: 12,
            height: 8
        });

        const concurrency = new GraphWidget({
            title: 'Concurrency',
            region: region,
            left: concurrentMetricArray,
            width: 6,
            height: 8
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