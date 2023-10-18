import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {RdsWidgetSet} from "./rds";
import {Construct} from "constructs";

export class AuroraWidgetSet extends Construct  implements WidgetSet{
    widgetSet:any = [];
    namespace:string = 'AWS/RDS';
    alarmSet:any = [];
    config:any = {};

    constructor(scope: Construct, id:string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        let aurora = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        let maz = resource.MultiAZ?" (MAZ)":" (SAZ)";
        let engine = resource.Engine;
        let region = resource.ResourceARN.split(':')[3];
        const title = new TextWidget({
            height: 1,
            markdown: '### Cluster ' + aurora + maz + ' ' + engine,
            width: 24
        })
        this.widgetSet.push(new Row(title));
        const widget = new GraphWidget({
            title: 'CpuUtilisation '+aurora + maz + ' ' + engine,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'CPUUtilization',
                dimensionsMap: {
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 8
        })
        const latency = new GraphWidget({
            title: 'Latencies '+aurora + maz + ' ' + engine,
            region: region,
            width: 8,
            left:[new Metric({
                namespace: this.namespace,
                metricName: 'InsertLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'DDLLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'DMLLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'SelectLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'UpdateLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'ReadLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'WriteLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'CommitLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'DeleteLatency',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'AuroraReplicaLagMaximum',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'AuroraReplicaLagMinimum',
                dimensionsMap:{
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })]
        });
        const connsdisk = new GraphWidget({
            title: 'Connections '+aurora + maz + ' ' + engine,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'DatabaseConnections',
                dimensionsMap: {
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'VolumeWriteIOPs',
                dimensionsMap: {
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'VolumeReadIOPs',
                dimensionsMap: {
                    DBClusterIdentifier: aurora
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 8
        })
        this.widgetSet.push(new Row(widget,latency,connsdisk));
        if ( resource.DBClusterMembers && resource.DBClusterMembers.length > 0 ){
            let counter = 0;
            for (let member of resource.DBClusterMembers){
                let dbid = member.DBInstanceIdentifier;
                let arnarray = resource.ResourceARN.split(':');
                arnarray[arnarray.length - 1]=dbid;
                arnarray[arnarray.length - 2]="db";
                member.ResourceARN = arnarray.join(':');
                member.Engine = resource.Engine;
                let wgt = new RdsWidgetSet(this,'RDSWidgetSet' + counter,member);
                for ( let row of wgt.getWidgetSets()){
                    this.widgetSet.push(row);
                }
                counter++;
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
