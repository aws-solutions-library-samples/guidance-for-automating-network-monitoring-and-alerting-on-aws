import {IWidgetSet, WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {Duration} from "aws-cdk-lib";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";

export class SQSGroupWidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string = 'AWS/SQS'
    widgetSet: any = [];
    alarmSet: any = [];
    config: any = {}

    constructor(scope:Construct, id:string, resourceArray:any, config:any) {
        super(scope,id);
        this.config = config;
        const region = resourceArray[0].ResourceARN.split(':')[3];
        let widgetHeight = 8
        const queuesperwidget = Math.min(config.CompactMaxResourcesPerWidget, 100);
        if ( resourceArray.length > 5 ){
            widgetHeight = 14
        }
        let markDown = "**SQS queues in " + region + '**';
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);
        let queuesremaining = 0;
        if ( resourceArray && resourceArray.length && resourceArray.length > 0 ){
            queuesremaining = resourceArray.length;
        }

        while ( queuesremaining > 0 ){
            let queueIncrement = resourceArray.splice(0, queuesperwidget);
            const visibleMessages = this.getMetricArray(queueIncrement,'ApproximateNumberOfMessagesVisible');
            const notVisibleMessages = this.getMetricArray(queueIncrement,'ApproximateNumberOfMessagesNotVisible');

            const numberMessagesSent = this.getMetricArray(queueIncrement,'NumberOfMessagesSent');
            const numberOfMessagesReceived = this.getMetricArray(queueIncrement,'NumberOfMessagesReceived');


            const approximateNumberOfMessagesDelayed = this.getMetricArray(queueIncrement,'ApproximateNumberOfMessagesDelayed');
            const approximateAgeOfOldestMessage = this.getMetricArray(queueIncrement,'ApproximateAgeOfOldestMessage');

            const numberOfMessagesDeleted = this.getMetricArray(queueIncrement,'NumberOfMessagesDeleted');
            const numberOfEmptyReceives = this.getMetricArray(queueIncrement,'NumberOfEmptyReceives');



            const messageVisibility = new GraphWidget({
                title: 'ApproximateNumberOfMessagesVisible/ApproximateNumberOfMessagesNotVisible',
                region: region,
                left: visibleMessages,
                right: notVisibleMessages,
                width: 6,
                height: widgetHeight
            });

            const messagesSentRecv = new GraphWidget({
                title: `NumberOfMessagesSent/NumberOfMessagesReceived`,
                region: region,
                left: numberMessagesSent,
                right: numberOfMessagesReceived,
                width: 6,
                height: widgetHeight
            });

            const messagesDelayedAndOldestMessage = new GraphWidget({
                title: 'ApproximateNumberOfMessagesDelayed/ApproximateAgeOfOldestMessage',
                region: region,
                left: approximateNumberOfMessagesDelayed,
                right: approximateAgeOfOldestMessage,
                width: 6,
                height: widgetHeight
            });

            const countDeletedEmptyReceives = new GraphWidget({
                title: 'NumberOfMessagesDeleted/NumberOfEmptyReceives',
                region: region,
                left: numberOfMessagesDeleted,
                right: numberOfEmptyReceives,
                width: 6,
                height: widgetHeight
            });

            this.addWidgetRow(messageVisibility,messagesSentRecv,messagesDelayedAndOldestMessage,countDeletedEmptyReceives);
            queuesremaining -= queuesperwidget;
        }


    }

    private getMetricArray(queues:any,metric:string,period?:Duration,statistic?:Statistic){
        let metricArray:Metric[] = [];
        let metricPeriod = Duration.minutes(1);
        let metricStatistic = Statistic.SUM
        if ( period ){
            metricPeriod = period;
        }
        if ( statistic ){
            metricStatistic = statistic;
        }
        for (let queue of queues){
            const queueName = queue.ResourceARN.split(':')[queue.ResourceARN.split(':').length - 1];
            metricArray.push(new Metric({
                namespace: this.namespace,
                label:queueName,
                metricName: metric,
                dimensionsMap: {
                    QueueName: queueName
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