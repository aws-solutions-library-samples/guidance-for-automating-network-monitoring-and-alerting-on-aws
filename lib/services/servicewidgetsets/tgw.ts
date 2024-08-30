import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {
    GraphWidget,
    MathExpression,
    Metric,
    Row,
    Stats,
    TextWidget,
    TextWidgetBackground
} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {ConcreteWidget} from "aws-cdk-lib/aws-cloudwatch/lib/widget";

export class TgwWidgetSet extends WidgetSet implements IWidgetSet{
    namespace:string = "AWS/TransitGateway";
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};
    widgetCount:number = 0;


    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        const tgwId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### TGW [${tgwId}](https://${region}.console.aws.amazon.com/vpc/home?region=${region}#TransitGatewayDetails:transitGatewayId=${tgwId}) Attachments:${resource.attachments.length} Peers:${this.countPeers(resource)}`
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1,
            background: TextWidgetBackground.TRANSPARENT
        });
        //this.widgetSet.push();
        this.addWidgetRow(textWidget);

        const bytesOutMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesOut',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const bytesInMatric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesIn',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const packetsOutMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsOut',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const packetsInMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsIn',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const packetsInExpression = new MathExpression({
            expression: 'packetsInMetric/60',
            label: 'PPS In',
            period: Duration.minutes(1),
            usingMetrics: {
                packetsInMetric: packetsInMetric
            }
        });

        const packetsOutExpression = new MathExpression({
            expression: 'packetsOutMetric/60',
            label: 'PPS Out',
            period: Duration.minutes(1),
            usingMetrics: {
                packetsOutMetric: packetsOutMetric
            }
        });

        const bytesDropCountBlackhole = new Metric({
            namespace: this.namespace,
            metricName: 'BytesDropCountBlackhole',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SAMPLE_COUNT,
            period: Duration.minutes(1)
        });

        const packetsDropCountBlackhole = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsDropCountBlackhole',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SAMPLE_COUNT,
            period: Duration.minutes(1)
        });

        const bytesDropCountNoRoute = new Metric({
            namespace: this.namespace,
            metricName: 'BytesDropCountNoRoute',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SAMPLE_COUNT,
            period: Duration.minutes(1)
        });

        const packetsDropCountNoRoute = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsDropCountNoRoute',
            dimensionsMap: {
                TransitGateway: tgwId
            },
            statistic: Stats.SAMPLE_COUNT,
            period: Duration.minutes(1)
        });

        const bytesWidget = new GraphWidget({
            title: 'Bytes In/Out',
            left:[bytesInMatric],
            right:[bytesOutMetric],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 5
        });

        const packetsWidget = new GraphWidget({
            title: 'PPS In/Out',
            left:[packetsInExpression],
            right:[packetsOutExpression],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 5
        });

        const droppedWidget = new GraphWidget({
            title: 'Dropped packets/bytes',
            left:[packetsDropCountNoRoute,packetsDropCountBlackhole],
            right:[bytesDropCountNoRoute,bytesDropCountBlackhole],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 5
        });

        //this.widgetSet.push(new Row(bytesWidget,packetsWidget,droppedWidget));
        this.addWidgetRow(bytesWidget,packetsWidget,droppedWidget);

        for ( let attachment of resource.attachments ){
            const attachmentId = attachment.TransitGatewayAttachmentId
            console.log(attachmentId);
            let vpcMarkup = '';
            if ( attachment.ResourceType === 'vpc'){
                vpcMarkup = ` - [${attachment.ResourceId}](https://${region}.console.aws.amazon.com/vpc/home?region=${region}#VpcDetails:VpcId=${attachment.ResourceId})`
            }
            let markDown = `**Attachment [${attachmentId}](https://${region}.console.aws.amazon.com/vpc/home?region=${region}#TransitGatewayAttachmentDetails:transitGatewayAttachmentId=${attachmentId}) Type:${attachment.ResourceType}${vpcMarkup}**`
            let attachTextWidget = new TextWidget({
                markdown: markDown,
                width: 24,
                height: 1,
                background: TextWidgetBackground.TRANSPARENT
            })
            //this.widgetSet.push();
            this.addWidgetRow(attachTextWidget);
            const attBytesOutMetric = new Metric({
                namespace: this.namespace,
                metricName: 'BytesOut',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SUM,
                period: Duration.minutes(1)
            });

            const attBytesInMetric = new Metric({
                namespace: this.namespace,
                metricName: 'BytesIn',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SUM,
                period: Duration.minutes(1)
            });

            const attPacketsOutMetric = new Metric({
                namespace: this.namespace,
                metricName: 'PacketsOut',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SUM,
                period: Duration.minutes(1)
            });

            const attPacketsOutExpression = new MathExpression({
                expression: 'attPacketsOutMetric/60',
                label: 'PPS Out',
                usingMetrics:{
                    attPacketsOutMetric: attPacketsOutMetric
                },
                period: Duration.minutes(1)
            });

            const attPacketsInMetric = new Metric({
                namespace: this.namespace,
                metricName: 'PacketsIn',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SUM,
                period: Duration.minutes(1)
            });

            const attPacketsInExpression = new MathExpression({
                expression: 'attPacketsInMetric/60',
                label: 'PPS In',
                usingMetrics:{
                    attPacketsInMetric: attPacketsInMetric
                },
                period: Duration.minutes(1)
            });

            const attBytesDropCountBlackhole = new Metric({
                namespace: this.namespace,
                metricName: 'BytesDropCountBlackhole',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SAMPLE_COUNT,
                period: Duration.minutes(1)
            });

            const attPacketsDropCountBlackhole = new Metric({
                namespace: this.namespace,
                metricName: 'PacketsDropCountBlackhole',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SAMPLE_COUNT,
                period: Duration.minutes(1)
            });

            const attBytesDropCountNoRoute = new Metric({
                namespace: this.namespace,
                metricName: 'BytesDropCountNoRoute',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SAMPLE_COUNT,
                period: Duration.minutes(1)
            });

            const attPacketsDropCountNoRoute = new Metric({
                namespace: this.namespace,
                metricName: 'PacketsDropCountNoRoute',
                dimensionsMap: {
                    TransitGateway: tgwId,
                    TransitGatewayAttachment: attachmentId
                },
                statistic: Stats.SAMPLE_COUNT,
                period: Duration.minutes(1)
            });

            const attBytesWidget = new GraphWidget({
                title: 'Bytes In/Out',
                left:[attBytesInMetric],
                right:[attBytesOutMetric],
                period: Duration.minutes(1),
                region: region,
                width: 8,
                height: 3
            });

            const attPacketsWidget = new GraphWidget({
                title: 'PPS In/Out',
                left:[attPacketsInExpression],
                right:[attPacketsOutExpression],
                period: Duration.minutes(1),
                region: region,
                width: 8,
                height: 3
            });

            const attDroppedWidget = new GraphWidget({
                title: 'Dropped packets/bytes',
                left:[attPacketsDropCountNoRoute,attPacketsDropCountBlackhole],
                right:[attBytesDropCountNoRoute,attBytesDropCountBlackhole],
                period: Duration.minutes(1),
                region: region,
                width: 8,
                height: 3
            });

            //this.widgetSet.push(new Row(attBytesWidget,attPacketsWidget,attDroppedWidget));
            this.addWidgetRow(attBytesWidget,attPacketsWidget,attDroppedWidget)
        }

    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    countPeers(resource:any){
        let peerCount = 0;
        for (let attachment of resource.attachments ){
            if ( attachment.ResourceType === "peering" ){
                peerCount++;
            }
        }
        return peerCount;
    }

    addWidgetRow(...widgets:ConcreteWidget[]){
        let count = 0
        let row = new Row();
        for (const widgetElement of widgets) {
            count += 1;
            row.addWidget(widgetElement);
        }
        this.widgetCount += count;
        this.widgetSet.push(row);
    }

    getWidgetCount(): number {
        return this.widgetCount;
    }

}