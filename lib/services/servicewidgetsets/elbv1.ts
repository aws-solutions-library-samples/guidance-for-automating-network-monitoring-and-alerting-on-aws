import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Stats, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class ELBv1WidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string = 'AWS/ELB'
    widgetSet:any = []
    alarmSet:any = []
    config:any = {}

    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope,id);
        this.config = config;
        const elbName = resource.Extras.LoadBalancerName
        const region = resource.ResourceARN.split(':')[3];
        let markDown = "**ELB (Classic) " + elbName+'**';
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const spilloverCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'SpilloverCount',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Stats.SUM,
            period: Duration.minutes(5)
        })

        const surgeQueueLengthMetric = new Metric({
            namespace: this.namespace,
            metricName: 'SurgeQueueLength',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Stats.MAXIMUM,
            period: Duration.minutes(5)
        })

        const totRequestCount = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                LoadBalancerName: elbName
            },
            statistic: Stats.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ1 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'a'
            },
            statistic: Stats.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ2 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'b'
            },
            statistic: Stats.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ3 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'c'
            },
            statistic: Stats.SUM,
            period: Duration.seconds(1)
        })

        const unhealthyHost = new Metric({
            namespace: this.namespace,
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Stats.AVERAGE,
            period: Duration.minutes(5)
        })

        const alarmUnhealthyHosts = unhealthyHost.createAlarm(this,`alarmUnhe-${elbName}-${region}-${this.config.BaseName}`, {
            alarmName: `ELB-${elbName}-${region}-${this.config.BaseName} unhealthy hosts`,
            datapointsToAlarm: 5,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            threshold: 1,
            evaluationPeriods: 5
        })

        this.alarmSet.push(alarmUnhealthyHosts)

        const surgeCountWidget = new GraphWidget({
            title: 'SurgeQ/SpilloverCount',
            region: region,
            left: [surgeQueueLengthMetric],
            right:[spilloverCountMetric],
            width: 10,
            height: 4
        })

        const requestCountWidget = new GraphWidget({
            title: 'Request Count',
            region: region,
            left: [totRequestCount],
            right:[requestAZ1,requestAZ2,requestAZ3],
            width: 10,
            height: 4
        })

        const unhealthyCountWidget = new GraphWidget({
            title: 'Unhealthy hosts',
            region: region,
            left: [unhealthyHost],
            width: 4,
            height: 4
        })

        this.addWidgetRow(surgeCountWidget,requestCountWidget,unhealthyCountWidget);
    }

    getWidgetSets(): [] {
        return this.widgetSet
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}