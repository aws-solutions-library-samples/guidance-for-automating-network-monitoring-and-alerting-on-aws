import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class EbsWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/EBS'
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id:string, resource:any) {
        super(scope, id);
        let volid = resource.VolumeId;
        let region = resource.AvailabilityZone.slice(0, -1);
        let type = resource.VolumeType;
        let iops = resource.Iops;
        let markDown = "**EBS Volume [" + volid + '](https://'+region+'.console.aws.amazon.com/ec2/v2/home?region='+region+'#VolumeDetails:volumeId='+volid+')**';
        if ( iops ){
            markDown = "**EBS Volume [" + volid + '](https://'+region+'.console.aws.amazon.com/ec2/v2/home?region='+region+'#VolumeDetails:volumeId='+volid+')  (' + type + ' iops:' + iops + ')**'
        }
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))
        const widget = new GraphWidget({
            title: 'Disk '+volid + ' (' + type + ')',
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'VolumeReadBytes',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'VolumeWriteBytes',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'VolumeReadOps',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'VolumeWriteOps',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: type==="io1"|| type==="io2"?8:12,
            height: 3
        });

        const queues = new GraphWidget({
            title: 'Queues '+volid + ' (' + type + ')',
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'VolumeQueueLength',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'VolumeIdleTime',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'VolumeTotalWriteTime',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'VolumeTotalReadTime',
                dimensionsMap: {
                    VolumeId: volid
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: type==="io1"|| type==="io2"?8:12,
            height: 3
        });
        if ( type == "io1" || type == "io2"){
            const iowidget = new GraphWidget({
                title: 'Consumed IOPS '+volid + ' (' + type + ')',
                region: region,
                left: [new Metric({
                    namespace: this.namespace,
                    metricName: 'VolumeConsumedReadWriteOps',
                    dimensionsMap: {
                        VolumeId: volid
                    },
                    statistic: Statistic.AVERAGE,
                    period:Duration.minutes(1)
                })],
                right:[new Metric({
                    namespace: this.namespace,
                    metricName: 'VolumeThroughputPercentage',
                    dimensionsMap: {
                        VolumeId: volid
                    },
                    statistic: Statistic.AVERAGE,
                    period:Duration.minutes(1)
                })],
                width: 8,
                height: 3,
                rightYAxis: {
                    min:0,
                    max:100
                }
            });
            this.widgetSet.push(new Row(widget,queues,iowidget));
        } else {
            this.widgetSet.push(new Row(widget,queues));
        }

    }
    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

}
