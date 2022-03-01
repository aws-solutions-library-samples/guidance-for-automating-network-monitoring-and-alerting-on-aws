import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {EcsEC2WidgetSet} from "./ecsec2";
import {EcsFargateWidgetSet} from "./ecsfargate";

export class EcsWidgetSet extends Construct implements WidgetSet {
    namespace:string = "AWS/ECS";
    alarmSet:any = [];
    widgetSet:any = [];

    constructor(scope: Construct , id: string, resource:any) {
        super(scope,id);
        const region = resource.ResourceARN.split(':')[3];
        const cluster = resource.cluster;
        const clusterName = cluster.clusterName;
        const runningTasks = cluster.runningTasksCount;
        const activeServices = cluster.activeServicesCount;
        let markDown = `### ECS Cluster [${clusterName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}) Tasks: ${runningTasks} Services: ${activeServices}`;
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

        const CPUUtilisationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const CPUReservationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUReservation',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const MemoryUtilizationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const MemoryReservationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryReservation',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const ClusterCPUUtilisation = new GraphWidget({
            title: 'CPU Utilisation/Reservation',
            region: region,
            left: [CPUUtilisationMetric],
            right: [CPUReservationMetric],
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE,
            width: 12
        });

        const ClusterMemoryUtilisation = new GraphWidget({
            title: 'Memory Utilisation/Reservation',
            region: region,
            left: [MemoryUtilizationMetric],
            right: [MemoryReservationMetric],
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE,
            width: 12
        });

        this.widgetSet.push(new Row(ClusterCPUUtilisation,ClusterMemoryUtilisation));

        for (let service of resource.services){
            if ( service.launchType === "EC2" ){
                const ec2serviceWidgetSet = new EcsEC2WidgetSet(this,'ECSEC2WidgetSet' + this.getRandomString(6),service, clusterName);
                for ( let widget of ec2serviceWidgetSet.getWidgetSets()){
                    this.widgetSet.push(widget);
                }
                this.alarmSet = this.alarmSet.concat(ec2serviceWidgetSet.getAlarmSet());
            } else {
                const fargateServiceWidgetSet = new EcsFargateWidgetSet(this,'FargateWidgetSet' + this.getRandomString(6), service, clusterName);
                for ( let widget of fargateServiceWidgetSet.getWidgetSets()){
                    this.widgetSet.push(widget);
                }
                this.alarmSet = this.alarmSet.concat(fargateServiceWidgetSet.getAlarmSet());
            }

        }

    }

    private getRandomString(length:number){
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}