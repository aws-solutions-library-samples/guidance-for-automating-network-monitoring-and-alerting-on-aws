import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class SQSWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/SQS'
    widgetSet:any=[];
    alarmSet:any = [];
    config:any = {};

    constructor(scope: Construct, id:string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        let arn = resource.ResourceARN
        let queueName = arn.split(':')[arn.split(':').length - 1];
        let region = arn.split(':')[3];
        let accountId = arn.split(':')[4];
        let markDown = `#### Queue [${queueName}](https://${region}.console.aws.amazon.com/sqs/v2/home?region=${region}#/queues/https%3A%2F%2Fsqs.${region}.amazonaws.com%2F${accountId}%2F${queueName})`
        if (resource.Attributes){
            if ( resource.Attributes.FifoQueue ){
                markDown += `, Type: FIFO`;
            } else {
                markDown += `, Type: Standard`;
            }

            if ( resource.Attributes.MaximumMessageSize ){
                markDown += `, Message Size: ${resource.Attributes.MaximumMessageSize/1024}kb`
            }

            if ( resource.Attributes.MessageRetentionPeriod ){
                markDown += `, Message Retention (hrs): ${resource.Attributes.MessageRetentionPeriod/60/60}`
            }

            if ( resource.Attributes.RedrivePolicy ){
                let redrivePolicy = JSON.parse(resource.Attributes.RedrivePolicy);
                let dlQueueARN = redrivePolicy.deadLetterTargetArn;
                let dlQueueName = dlQueueARN.split(':')[dlQueueARN.split(':').length-1];
                let dlAccountId = dlQueueARN.split(':')[4];
                let dlRegion = dlQueueARN.split(':')[3];
                markDown += `, Dead Letter:[${dlQueueName}](https://${dlRegion}.console.aws.amazon.com/sqs/v2/home?region=${dlRegion}#/queues/https%3A%2F%2Fsqs.${region}.amazonaws.com%2F${dlAccountId}%2F${dlQueueName})`
            }


        }
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))


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
