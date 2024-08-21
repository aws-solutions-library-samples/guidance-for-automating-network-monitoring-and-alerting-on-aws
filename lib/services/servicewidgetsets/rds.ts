import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class RdsWidgetSet extends Construct implements IWidgetSet{
    widgetSet:any = [];
    namespace:string = 'AWS/RDS'
    alarmSet:any = [];

    constructor(scope:Construct, id:string, resource:any) {
        super(scope, id);
        let rds = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        let maz = resource.MultiAZ?" (MAZ)":" (SAZ)";
        let engine = resource.Engine;
        let region = resource.ResourceARN.split(':')[3];
        let role="";
        if ( resource.IsClusterWriter && resource.IsClusterWriter == true){
            role = " (writer)"
        } else {
            console.log('Cant really determine if this is aurora');
        }

        const widget = new GraphWidget({
            title: 'CpuUtilisation '+rds + maz + ' ' + engine + role,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'CPUUtilization',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 6
        });
        const disk = new GraphWidget({
            title: 'DISK '+rds + maz + ' ' + engine+ role,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Queries',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Deadlocks',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'WriteIOPS',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 12
        });
        const connections = new GraphWidget({
            title: 'DISK '+rds + maz + ' ' + engine+ ' (' + role + ')',
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ActiveTransactions',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'BufferCacheHitRatio',
                dimensionsMap: {
                    DBInstanceIdentifier: rds
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 6
        });

        this.widgetSet.push(new Row(widget,disk,connections));
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
