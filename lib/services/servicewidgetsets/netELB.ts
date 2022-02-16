import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget, TreatMissingData, Unit} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {ApplicationTargetGroup} from "aws-cdk-lib/aws-elasticloadbalancingv2";

export class NetworkELBWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/NetworkELB';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource: any) {
        super(scope, id);
        const elbName = resource.Extras.LoadBalancerName;
        const targetGroups = resource.TargetGroups;

        const region = resource.ResourceARN.split(':')[3];
        const type = resource.Extras.Type;
        const elbID = resource.ResourceARN.split('/')[3]
        const elbCWName = 'net/' + elbName + '/' + elbID;
        const AZs = resource.Extras.AvailabilityZones;

        this.widgetSet.push(new TextWidget({
            markdown: "**ELB (NLB) " + elbName+'**',
            width: 24,
            height: 1
        }))

        /***
         * Metrics
         */
        let activeFlowPerAZarray = [];
        let newFlowCountMetricArray = [];

        for ( let az of AZs ){
            let zoneName = az.ZoneName;
            let activeMetric = new Metric({
                namespace: this.namespace,
                metricName: 'ActiveFlowCount',
                dimensionsMap: {
                    LoadBalancer: elbCWName,
                    AvailabilityZone: zoneName
                },
                statistic: Statistic.AVERAGE,
                period: Duration.minutes(1),
                unit: Unit.COUNT,
                region: region
            });
            activeFlowPerAZarray.push(activeMetric);

            let newFlowMetric = new Metric({
                namespace: this.namespace,
                metricName: 'NewFlowCount',
                dimensionsMap: {
                    LoadBalancer: elbCWName,
                    AvailabilityZone: zoneName
                },
                statistic: Statistic.AVERAGE,
                period: Duration.minutes(1),
                unit: Unit.COUNT,
                region: region
            });
            newFlowCountMetricArray.push(newFlowMetric);
        }

        let unhealthyHostCountMetricArray = [];

        for (let targetGroup of targetGroups){

            let targetGroupArn = targetGroup.TargetGroupArn;

            let targetGroupName = targetGroupArn.split(':')[targetGroupArn.split(':').length-1]

            let unhealthyMetric = new Metric({
                namespace: this.namespace,
                metricName: 'UnHealthyHostCount',
                dimensionsMap: {
                    TargetGroup: targetGroupName,
                    LoadBalancer: elbCWName

                },
                statistic: Statistic.MAXIMUM,
                period: Duration.minutes(1),
                unit: Unit.COUNT,
                region:region
            });

            let unhealthyAlarm = unhealthyMetric.createAlarm(this,'UHAlarm' + targetGroupName,{
                alarmName: 'Unhealthy Hosts ' + targetGroupName,
                datapointsToAlarm: 3,
                evaluationPeriods: 3,
                threshold: 3,
                treatMissingData: TreatMissingData.NOT_BREACHING
            });

            this.alarmSet.push(unhealthyAlarm);
            unhealthyHostCountMetricArray.push(unhealthyMetric);
        }

        const consumedLCUsMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ConsumedLCUs',
            dimensionsMap: {
                LoadBalancer: elbCWName
            },
            statistic: Statistic.MAXIMUM,
            period: Duration.minutes(1),
            region:region
        })

        const peakBytesPerSecond = new Metric({
            namespace: this.namespace,
            metricName: 'PeakBytesPerSecond',
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            statistic: Statistic.MAXIMUM,
            period: Duration.minutes(1),
            region: region
        })

        const processedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'ProcessedPackets',
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1),
            region: region
        });

        const tcpClientRST = new Metric({
            namespace: this.namespace,
            metricName: 'TCP_Client_Reset_Count',
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1),
            region: region
        });

        const tcpELBRST = new Metric({
            namespace: this.namespace,
            metricName: 'TCP_ELB_Reset_Count',
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1),
            region: region
        });

        const tcpTargetRST = new Metric({
            namespace: this.namespace,
            metricName: 'TCP_Target_Reset_Count',
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(1),
            region: region
        });




        /***
         * Alarms
         */


        /***
         * Widgets
         */

        const flowsWidget = new GraphWidget({
            title: 'Active/New Flows',
            left: activeFlowPerAZarray,
            right: newFlowCountMetricArray,
            period: Duration.minutes(1),
            width: 10,
            region: region
        })

        const unHealthyHostWidget = new GraphWidget({
            title: 'Unhealthy Hosts',
            left: unhealthyHostCountMetricArray,
            period: Duration.minutes(1),
            width: 4,
            region: region
        })

        const lcuPeakBytesPerSecond = new GraphWidget({
            title: 'LCU / PeakBytesPerSecond',
            region: region,
            left: [consumedLCUsMetric],
            right: [peakBytesPerSecond],
            period: Duration.minutes(1),
            width: 10
        })

        const packetsWidget = new GraphWidget({
            title: 'Processed Packets',
            region: region,
            left:[processedPackets],
            period: Duration.minutes(1),
            width: 6
        });

        const tcpClientRSTWidget = new GraphWidget({
            title: 'RST client',
            region: region,
            left:[tcpClientRST],
            period: Duration.minutes(1),
            width: 6
        });

        const tcpELBRSTWidget = new GraphWidget({
            title: 'RST ELB',
            region: region,
            left:[tcpELBRST],
            period: Duration.minutes(1),
            width: 6
        });

        const tcpTargetRSTWidget = new GraphWidget({
            title: 'RST Target',
            region: region,
            left:[tcpTargetRST],
            period: Duration.minutes(1),
            width: 6
        });



        this.widgetSet.push(new Row(flowsWidget,unHealthyHostWidget,lcuPeakBytesPerSecond));
        this.widgetSet.push(new Row(packetsWidget,tcpClientRSTWidget,tcpELBRSTWidget,tcpTargetRSTWidget));

    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }
}