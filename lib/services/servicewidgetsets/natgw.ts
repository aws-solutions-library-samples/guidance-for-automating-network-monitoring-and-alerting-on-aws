import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class NatgwWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/NATGateway';
    widgetSet:any = [];
    alarmSet:any = [];


    constructor(scope: Construct, id: string, resource:any) {
        super(scope, id);
        const natgwId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### NATGW [${natgwId}](https://${region}.console.aws.amazon.com/vpc/home?region=${region}#TransitGatewayDetails:transitGatewayId=${natgwId})`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

        
        const activeConnectionCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ActiveConnectionCount',
            dimensionsMap: {
                NatGatewayId : natgwId
            },
            statistic: Statistic.MAXIMUM,
            period: Duration.minutes(1)
        });
        
        
        const connectionAttemptCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionAttemptCount',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const connectionEstablishedCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionEstablishedCount',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const bytesInFromDestinationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesInFromDestination',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });
        
        const bytesOutToDestinationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesOutToDestination',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const bytesInFromSourceMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesInFromSource',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const bytesOutToSourceMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesOutToSource',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const packetsInFromDestinationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsInFromDestination',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const packetsOutToDestinationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsOutToDestination',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const packetsInFromSourceMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsInFromSource',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const packetsOutToSourceMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsOutToSource',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const errorPortAllocationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ErrorPortAllocation',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const packetsDropCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'PacketsDropCount',
            dimensionsMap: {
                NatGatewayId: natgwId
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const errorPortAllocationAlarm = errorPortAllocationMetric.createAlarm(this,'errorPortAlarm-'+natgwId,{
            alarmName: 'Port Allocation Error ' + natgwId,
            datapointsToAlarm: 3,
            threshold: 3,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 3
        });

        const packetsDropCountAlarm = packetsDropCountMetric.createAlarm(this,'packetDropAlarm-'+natgwId,{
            alarmName: 'Packets Dropped Error ' + natgwId,
            datapointsToAlarm: 3,
            threshold: 3,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 3
        });
        this.alarmSet.push(errorPortAllocationAlarm,packetsDropCountAlarm);



        /***
         * Widgets
         */
        const connectionWidget = new GraphWidget({
            title: 'Connections',
            left: [activeConnectionCountMetric],
            right: [connectionAttemptCountMetric,connectionEstablishedCountMetric],
            period: Duration.minutes(1),
            region: region,
            width: 8
        });

        const bytesTrafficWidget = new GraphWidget({
            title: 'Flows in bytes',
            left: [bytesInFromSourceMetric, bytesOutToDestinationMetric],
            right: [bytesInFromDestinationMetric,bytesOutToSourceMetric],
            period: Duration.minutes(1),
            region: region,
            width: 8
        });

        const packetsTrafficWidget = new GraphWidget({
            title: 'Packet flows',
            left: [packetsInFromSourceMetric,packetsOutToDestinationMetric],
            right: [packetsInFromDestinationMetric,packetsOutToSourceMetric],
            period: Duration.minutes(1),
            region: region,
            width: 8
        });

        this.widgetSet.push(new Row(connectionWidget,bytesTrafficWidget,packetsTrafficWidget));


    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
