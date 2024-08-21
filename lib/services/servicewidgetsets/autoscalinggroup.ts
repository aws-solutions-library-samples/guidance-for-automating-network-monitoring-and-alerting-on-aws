import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class ASGWidgetSet extends Construct implements IWidgetSet{
    namespace:string='AWS/EC2';
    widgetSet:any=[];
    alarmSet:any = [];
    config:any = {}

    constructor(scope:Construct, id:string, arn:string, config:any) {
        super(scope, id);
        this.config = config;
        let asgName = arn.split('/')[arn.split('/').length - 1];
        let region = arn.split(':')[3];
        const networkWidget = new GraphWidget({
            title: 'Network ASG-'+asgName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'NetworkPacketsOut',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'NetworkPacketsIn',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'NetworkIn',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'NetworkOut',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            width: 6
        });
        const cpuwidget = new GraphWidget({
            title: 'CPU ASG-'+asgName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'CPUUtilization',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'CPUCreditUsage',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'CPUCreditBalance',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            width: 6
        });

        const widget = new GraphWidget({
            title: 'Disk ASG'+asgName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'EBSWriteBytes',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSWriteOps',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSIOBalance%',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSReadBytes',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSReadOps',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 12
        });

        const asgWidget = new GraphWidget({
            title: 'ASG-'+asgName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'GroupTerminatingInstances',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupDesiredCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'GroupMaxSize',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupStandbyCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupTerminatingCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupTotalCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupStandbyInstances',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupMinSize',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupTotalInstances',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupInServiceInstances',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupInServiceCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupPendingInstances',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'GroupPendingCapacity',
                dimensionsMap: {
                    AutoScalingGroupName: asgName
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 24
        });
        this.widgetSet.push(new Row(networkWidget,widget,cpuwidget));
        this.widgetSet.push(new Row(asgWidget));
    }
    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
