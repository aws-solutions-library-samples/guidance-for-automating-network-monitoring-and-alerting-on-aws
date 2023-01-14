import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class SQSWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/SQS'
    widgetSet:any=[];
    alarmSet:any = [];

    constructor(scope: Construct, id:string, resource:any) {
        super(scope, id);
        let arn = resource.ResourceARN
        let queueName = arn.split(':')[arn.split(':').length - 1];
        let region = arn.split(':')[3];
        const widget = new GraphWidget({
            title: 'Message Count  '+queueName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ApproximateNumberOfMessagesVisible',
                dimensionsMap: {
                    QueueName: queueName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace:this.namespace,
                metricName: 'ApproximateNumberOfMessagesNotVisible',
                dimensionsMap:{
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 6
        });



        const sentReceivedWidget = new GraphWidget({
            title: 'No Messages Sent/Received',
            region: region,
            left:[new Metric({
                namespace: this.namespace,
                metricName: 'NumberOfMessagesSent',
                dimensionsMap: {
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'NumberOfMessagesReceived',
                dimensionsMap: {
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 6
        })

        const delayWidget = new GraphWidget({
            title: 'Messages delayed/Age oldest message ' + queueName,
            region: region,
            left:[new Metric({
                namespace:this.namespace,
                metricName: 'ApproximateNumberOfMessagesDelayed',
                dimensionsMap:{
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace:this.namespace,
                metricName: 'ApproximateAgeOfOldestMessage',
                dimensionsMap:{
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 6
        })



        const widget2 = new GraphWidget({
            title: 'Delays ' + queueName,
            region: region,
            left:[new Metric({
                namespace: this.namespace,
                metricName: 'NumberOfMessagesDeleted',
                dimensionsMap: {
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace:this.namespace,
                metricName: 'NumberOfEmptyReceives',
                dimensionsMap:{
                    QueueName: queueName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 6
        })
        this.widgetSet.push(new Row(widget,sentReceivedWidget,delayWidget,widget2));
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}
