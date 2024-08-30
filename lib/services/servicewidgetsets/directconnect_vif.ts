import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Stats, TextWidget, TextWidgetBackground} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class DirectConnectVIFWidgetSet extends WidgetSet implements IWidgetSet {
    namespace: string = 'AWS/DX';
    widgetSet: any = [];
    alarmSet: any = [];
    config: any = {};
    widgetCount:number = 0;

    constructor(scope: Construct, id: string, resource: any, config: any) {
        super(scope, id);
        this.config = config;
        const region = resource.ResourceARN.split(':')[3];
        const account = resource.ResourceARN.split(':')[4];
        const virtualInterfaceId = resource.vif.virtualInterfaceId;
        const connectionId = resource.vif['connectionId'];
        const vifName = resource.vif['virtualInterfaceName'];
        const type = resource.vif['virtualInterfaceType'];
        const mtu = resource.vif['mtu'];
        const directConnectGatewayId = resource.vif['directConnectGatewayId'];
        const asn = resource.vif['asn'];

        let markDown = `#### VIF: [${virtualInterfaceId}/${vifName}](https://us-east-1.console.aws.amazon.com/directconnect/v2/home?region=${region}#/virtual-interfaces/arn:aws:directconnect:${region}:${account}:${virtualInterfaceId})`
        markDown = `${markDown} DCGID: [${directConnectGatewayId}](https://us-east-1.console.aws.amazon.com/directconnect/v2/home?region=${region}#/dxgateways/${directConnectGatewayId}) CID: ${connectionId} ASN: ${asn} TYPE: ${type} MTU: ${mtu}`;

        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1,
            background: TextWidgetBackground.TRANSPARENT
        });

        this.addWidgetRow(textWidget);

        const vif_egress_bps = new Metric({
            namespace: this.namespace,
            metricName: 'VirtualInterfaceBpsEgress',
            label: 'VirtualInterfaceBpsEgress',
            dimensionsMap: {
                ConnectionId: connectionId,
                VirtualInterfaceId: virtualInterfaceId,

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const vif_ingress_bps = new Metric({
            namespace: this.namespace,
            metricName: 'VirtualInterfaceBpsIngress',
            label: 'VirtualInterfaceBpsIngress',
            dimensionsMap: {
                ConnectionId: connectionId,
                VirtualInterfaceId: virtualInterfaceId,

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const vif_egress_pps = new Metric({
            namespace: this.namespace,
            metricName: 'VirtualInterfacePpsEgress',
            label: 'VirtualInterfacePpsEgress',
            dimensionsMap: {
                ConnectionId: connectionId,
                VirtualInterfaceId: virtualInterfaceId,

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const vif_ingress_pps = new Metric({
            namespace: this.namespace,
            metricName: 'VirtualInterfacePpsIngress',
            label: 'VirtualInterfacePpsIngress',
            dimensionsMap: {
                ConnectionId: connectionId,
                VirtualInterfaceId: virtualInterfaceId,

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const bandwitdhWdiget = new GraphWidget({
            title: `${vifName} Bytes Ingress/Egress`,
            left:[vif_ingress_bps],
            right:[vif_egress_bps],
            period: Duration.minutes(1),
            region: region,
            width: 12,
            height: 4
        });

        const ppsWdiget = new GraphWidget({
            title: `${vifName} PPS Ingress/Egress`,
            left:[vif_ingress_pps],
            right:[vif_egress_pps],
            period: Duration.minutes(1),
            region: region,
            width: 12,
            height: 4
        });


        //this.widgetSet.push(new Row(bandwitdhWdiget,ppsWdiget));
        this.addWidgetRow(bandwitdhWdiget,ppsWdiget);
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

}

