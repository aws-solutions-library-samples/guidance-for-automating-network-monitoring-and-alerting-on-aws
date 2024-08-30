import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Stats, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {EcsEC2WidgetSet} from "./ecsec2";
import {EcsFargateWidgetSet} from "./ecsfargate";

export class EcsWidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string = "AWS/ECS";
    alarmSet:any = [];
    widgetSet:any = [];
    config:any = {};

    constructor(scope: Construct , id: string, resource:any, config:any) {
        super(scope,id);
        this.config = config;
        const region = resource.ResourceARN.split(':')[3];
        const cluster = resource.cluster;
        const clusterName = cluster.clusterName;
        const runningTasks = cluster.runningTasksCount;
        const activeServices = cluster.activeServicesCount;
        let markDown = `### ECS Cluster [${clusterName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}) Tasks: ${runningTasks} Services: ${activeServices}`;
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const CPUUtilisationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const CPUReservationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUReservation',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const MemoryUtilizationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const MemoryReservationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryReservation',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const ClusterCPUUtilisation = new GraphWidget({
            title: 'CPU Utilisation/Reservation',
            region: region,
            left: [CPUUtilisationMetric],
            right: [CPUReservationMetric],
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE,
            width: 12
        });

        const ClusterMemoryUtilisation = new GraphWidget({
            title: 'Memory Utilisation/Reservation',
            region: region,
            left: [MemoryUtilizationMetric],
            right: [MemoryReservationMetric],
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE,
            width: 12
        });

        this.addWidgetRow(ClusterCPUUtilisation,ClusterMemoryUtilisation);

        for (let service of resource.services){
            if ( service.launchType === "EC2" ){
                const ec2serviceWidgetSet = new EcsEC2WidgetSet(this,`ECSEC2WidgetSet-${service.serviceName}-${region}-${this.config.BaseName}`,service, clusterName, this.config);
                for ( let widget of ec2serviceWidgetSet.getWidgetSets()){
                    this.addWidgetRow(widget);
                }
                this.alarmSet = this.alarmSet.concat(ec2serviceWidgetSet.getAlarmSet());
            } else {
                const fargateServiceWidgetSet = new EcsFargateWidgetSet(this,`FargateWidgetSet-${service.serviceName}-${region}-${this.config.BaseName}`, service, clusterName, this.config);
                for ( let widget of fargateServiceWidgetSet.getWidgetSets()){
                    this.addWidgetRow(widget);
                }
                this.alarmSet = this.alarmSet.concat(fargateServiceWidgetSet.getAlarmSet());
            }

        }

    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}