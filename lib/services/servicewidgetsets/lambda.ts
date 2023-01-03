import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class LambdaWidgetSet extends Construct implements WidgetSet{
    namespace:string='AWS/Lambda';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope:Construct, id:string, resource:any) {
        super(scope, id);
        const functionName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        let name = functionName
        const region = resource.ResourceARN.split(':')[3];
        const memory = resource.Configuration.MemorySize;
        const runtime = resource.Configuration.Runtime;
        for ( const tag of resource.Tags ){
            if ( tag.Key === "Name"){
                name = tag.Value
            }
        }
        let markDown = `### Lambda [${name}](https://${region}.console.aws.amazon.com/lambda/home?region=${region}#/functions/${functionName}?tab=monitoring) Mem:${memory} RT:${runtime}`

        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))
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
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            height: 5
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
                metricName: 'Throttles',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 12,
            height: 5
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
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            height: 5
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
