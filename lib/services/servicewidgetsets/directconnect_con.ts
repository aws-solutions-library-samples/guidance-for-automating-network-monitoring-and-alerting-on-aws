import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Stats, TextWidget, TextWidgetBackground} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {DirectConnectVIFWidgetSet} from "./directconnect_vif";

export class DirectConnectConWidgetSet extends WidgetSet implements IWidgetSet {
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
        const connectionId = resource['connectionId'];
        const connectionName = resource['DirectConnect']['connectionName'];
        const directConnect = resource['DirectConnect'];

        let markDown = `### CON: [${connectionId}/${connectionName}](https://us-east-1.console.aws.amazon.com/directconnect/v2/home?region=${region}#/connections/arn:aws:directconnect:${region}:${account}:${connectionId})`
        markDown = `${markDown} State: ${directConnect['connectionState']}, VLAN: ${directConnect['vlan']}, Location: ${directConnect['location']}, Partner: ${directConnect['partnerName']}, Redundancy: ${directConnect['hasLogicalRedundancy']}`;

        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1,
            background: TextWidgetBackground.TRANSPARENT
        });

        this.addWidgetRow(textWidget);

        const connection_state = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionState',
            label: 'ConnectionState',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const bps_egress = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionBpsEgress',
            label: 'ConnectionBpsEgress',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const bps_ingress = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionBpsIngress',
            label: 'ConnectionBpsIngress',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const pps_egress = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionPpsEgress',
            label: 'ConnectionPpsEgress',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const pps_ingress = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionPpsIngress',
            label: 'ConnectionPpsIngress',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const connect_crc_err = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionCRCErrorCount',
            label: 'ConnectionCRCErrorCount',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const connect_err = new Metric({
            namespace: this.namespace,
            metricName: 'ConnectionErrorCount',
            label: 'ConnectionErrorCount',
            dimensionsMap: {
                ConnectionId: connectionId

            },
            statistic: Stats.SUM,
            period: Duration.minutes(1)
        });

        const statWidget = new GraphWidget({
            title: `${connectionName} status`,
            left:[connection_state],
            period: Duration.minutes(1),
            region: region,
            width: 3,
            height: 4
        });

        const bytesWidget = new GraphWidget({
            title: `${connectionName} Bytes Ingress/Egress`,
            left:[bps_ingress],
            right:[bps_egress],
            period: Duration.minutes(1),
            region: region,
            width: 7,
            height: 4
        });

        const ppsWidget = new GraphWidget({
            title: `${connectionName} PPS Ingress/Egress`,
            left:[pps_ingress],
            right:[pps_egress],
            period: Duration.minutes(1),
            region: region,
            width: 7,
            height: 4
        });

        const err_widget = new GraphWidget({
            title: `${connectionName} Errors`,
            left:[connect_err],
            right:[connect_crc_err],
            period: Duration.minutes(1),
            region: region,
            width: 7,
            height: 4
        })


        //this.widgetSet.push(new Row(bandwitdhWdiget,ppsWdiget));
        this.addWidgetRow(statWidget, bytesWidget, ppsWidget, err_widget);

        if ( resource['VIFs'] && resource['VIFs'].length > 0 ) {
            for ( let vif of resource['VIFs'] ) {
                const vifId:any = vif.vif.virtualInterfaceId;
                const vifWidgets = new DirectConnectVIFWidgetSet(this, `${connectionId}-${vifId}-${region}-${this.config.BaseName}`, vif, this.config);
                this.widgetSet.push(...vifWidgets.getWidgetSets());
                this.widgetCount += vifWidgets.getWidgetCount();
            }
        }
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

}

