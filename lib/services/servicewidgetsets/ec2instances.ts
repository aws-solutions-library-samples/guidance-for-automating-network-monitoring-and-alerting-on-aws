import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {EbsWidgetSet} from "./ebs";
import {Construct} from "constructs";

export class Ec2InstancesWidgetSet extends Construct implements WidgetSet{
    namespace:string='AWS/EC2';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource:any) {
        super(scope, id);
        const instanceId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let instanceName = '';
        let markDown = '**Instance [' + instanceId+'](https://' + region +'.console.aws.amazon.com/ec2/v2/home?region='+ region + '#InstanceDetails:instanceId='+ instanceId + ')**'
        if ( resource.Tags ){
            for ( let nameTag of resource.Tags ){
                if ( nameTag.Key === "Name" ){
                    instanceName = nameTag.Value;
                    markDown = '**Instance [' + instanceId+'](https://' + region +'.console.aws.amazon.com/ec2/v2/home?region='+ region + '#InstanceDetails:instanceId='+ instanceId + ')  ' + instanceName +'**'
                }
            }
        }
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))
        const widget = new GraphWidget({
            title: 'Disk '+instanceId,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'EBSWriteBytes',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSWriteOps',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSIOBalance%',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSReadBytes',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'EBSReadOps',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 12
        });
        const cpuwidget = new GraphWidget({
            title: 'CPU '+instanceId,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'CPUUtilization',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            width: 6
        });
        const networkWidget = new GraphWidget({
            title: 'Network '+instanceId,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'NetworkPacketsOut',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'NetworkPacketsIn',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'NetworkIn',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'NetworkOut',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            width: 6
        });
        this.widgetSet.push(new Row(widget,cpuwidget,networkWidget));

        for (const volume of resource.Volumes) {
            let vol = new EbsWidgetSet(this,'EBSWidgetSet'+volume.VolumeId,volume);
            for (let w of vol.getWidgetSets()){
                this.widgetSet.push(w);
            }
        }

    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
