import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class ELBv1WidgetSet extends Construct implements WidgetSet {
    namespace:string = 'AWS/ELB'
    widgetSet:any = []
    alarmSet:any = []

    constructor(scope: Construct, id: string, resource:any) {
        super(scope,id);
        const elbName = resource.Extras.LoadBalancerName
        const region = resource.ResourceARN.split(':')[3];

        this.widgetSet.push(new TextWidget({
            markdown: "**ELB (Classic) " + elbName+'**',
            width: 24,
            height: 1
        }))

        const spilloverCountMetric = new Metric({
            namespace: this.namespace,
            metricName: 'SpilloverCount',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Statistic.SUM,
            period: Duration.minutes(5)
        })

        const surgeQueueLengthMetric = new Metric({
            namespace: this.namespace,
            metricName: 'SurgeQueueLength',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Statistic.MAXIMUM,
            period: Duration.minutes(5)
        })

        const totRequestCount = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                LoadBalancerName: elbName
            },
            statistic: Statistic.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ1 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'a'
            },
            statistic: Statistic.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ2 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'b'
            },
            statistic: Statistic.SUM,
            period: Duration.seconds(1)
        })

        const requestAZ3 = new Metric({
            namespace: this.namespace,
            metricName: 'RequestCount',
            dimensionsMap:{
                AvailabilityZone: region + 'c'
            },
            statistic: Statistic.SUM,
            period: Duration.seconds(1)
        })

        const unhealthyHost = new Metric({
            namespace: this.namespace,
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
                LoadBalancerName: elbName
            },
            statistic: Statistic.AVERAGE,
            period: Duration.minutes(5)
        })

        const alarmUnhealthyHosts = unhealthyHost.createAlarm(this,'alarmUnhe' + elbName, {
            alarmName: 'ELB (' + elbName + ') unhealthy hosts',
            datapointsToAlarm: 5,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            threshold: 2,
            evaluationPeriods: 5
        })

        this.alarmSet.push(alarmUnhealthyHosts)

        const surgeCountWidget = new GraphWidget({
            title: 'SurgeQ/SpilloverCount',
            region: region,
            left: [surgeQueueLengthMetric],
            right:[spilloverCountMetric],
            width: 10
        })

        const requestCountWidget = new GraphWidget({
            title: 'Request Count',
            region: region,
            left: [totRequestCount],
            right:[requestAZ1,requestAZ2,requestAZ3],
            width: 10
        })

        const unhealthyCountWidget = new GraphWidget({
            title: 'Unhealthy hosts',
            region: region,
            left: [unhealthyHost],
            width: 4
        })

        this.widgetSet.push(new Row(surgeCountWidget,requestCountWidget,unhealthyCountWidget))



    }


    getWidgetSets(): [] {
        return this.widgetSet
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}