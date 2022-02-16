import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class LambdaWidgetSet extends Construct implements WidgetSet{
    namespace:string='AWS/Lambda';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope:Construct, id:string, arn:string) {
        super(scope, id);
        let functionName = arn.split(':')[arn.split(':').length - 1];
        let region = arn.split(':')[3];
        const widget = new GraphWidget({
            title: 'Invocations '+functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Invocations',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Duration',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })]
        })
        const widgetErrors = new GraphWidget({
            title: 'Errors/Throttles '+functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Errors',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Throttles '+functionName,
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 12
        })

        const widgetConcurrent = new GraphWidget({
            title: 'Concurrency ' + functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ConcurrentExecutions',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })]
        })

        this.widgetSet.push(new Row(widget,widgetErrors,widgetConcurrent));
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
