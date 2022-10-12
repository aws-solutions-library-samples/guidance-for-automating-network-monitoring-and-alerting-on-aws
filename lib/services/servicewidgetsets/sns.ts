import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class SNSWidgetSet extends Construct implements WidgetSet {
    namespace:string='AWS/SNS';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource: any) {
        super(scope,id);
        const topicName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### SNS - ${topicName}`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 2
        }));

        const noOfNotificationsDelivered = new Metric({
            namespace: this.namespace,
            metricName: 'NumberOfNotificationsDelivered',
            dimensionsMap: {
                TopicName: topicName
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const noOfNotificationsFailed = new Metric({
            namespace: this.namespace,
            metricName: 'NumberOfNotificationsFailed',
            dimensionsMap:{
                TopicName: topicName
            },
            statistic: Statistic.SUM,
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
            statistic: Statistic.SUM,
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
            statistic: Statistic.AVERAGE,
            period:Duration.minutes(1)
        });

        const sizeWidget = new GraphWidget({
            title: 'Publish Size',
            region: region,
            left: [publishSize],
            width: 6
        })

        this.widgetSet.push(new Row(deliveryWidget,messagesWidget,sizeWidget));

    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}