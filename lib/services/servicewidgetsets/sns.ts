import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Stats, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class SNSWidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string='AWS/SNS';
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};

    constructor(scope: Construct, id: string, resource: any, config:any) {
        super(scope,id);
        this.config = config;
        const topicName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### SNS - ${topicName}`
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const noOfNotificationsDelivered = new Metric({
            namespace: this.namespace,
            metricName: 'NumberOfNotificationsDelivered',
            dimensionsMap: {
                TopicName: topicName
            },
            statistic: Stats.SUM,
            period:Duration.minutes(1)
        });

        const noOfNotificationsFailed = new Metric({
            namespace: this.namespace,
            metricName: 'NumberOfNotificationsFailed',
            dimensionsMap:{
                TopicName: topicName
            },
            statistic: Stats.SUM,
            period:Duration.minutes(1)
        });

        const deliveryWidget = new GraphWidget({
            title: `Notification Delivery ${topicName}`,
            region: region,
            left: [noOfNotificationsDelivered],
            right: [noOfNotificationsFailed],
            width: 12
        });

        const noOfMessagesPublished = new Metric({
            namespace: this.namespace,
            metricName: 'NumberOfMessagesPublished',
            dimensionsMap:{
                TopicName: topicName
            },
            statistic: Stats.SUM,
            period:Duration.minutes(1)
        });

        const messagesWidget = new GraphWidget({
            title: 'Messages Published',
            region: region,
            left:[noOfMessagesPublished],
            width: 6
        })

        const publishSize = new Metric({
            namespace: this.namespace,
            metricName: 'PublishSize',
            dimensionsMap:{
                TopicName: topicName
            },
            statistic: Stats.AVERAGE,
            period:Duration.minutes(1)
        });

        const sizeWidget = new GraphWidget({
            title: 'Publish Size',
            region: region,
            left: [publishSize],
            width: 6
        })

        this.addWidgetRow(deliveryWidget,messagesWidget,sizeWidget);

    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}