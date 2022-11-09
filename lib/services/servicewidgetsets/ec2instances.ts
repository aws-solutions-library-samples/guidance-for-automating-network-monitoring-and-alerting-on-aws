import {GraphWidget, Metric, Row, Statistic, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {EbsWidgetSet} from "./ebs";
import {Construct} from "constructs";

export class Ec2InstancesWidgetSet extends Construct implements WidgetSet{
    namespace:string='AWS/EC2';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        const instanceId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        const instanceType = resource.Instance.InstanceType;
        let burstable = false;
        let burstmodeLabel = ''
        if ( instanceType.includes('t2') || instanceType.includes('t3') || instanceType.includes('t4')){
            burstable = true;
            burstmodeLabel = ` (${resource.CPUCreditSpecs.CpuCredits})`;
        }
        const instanceAz = resource.Instance.Placement.AvailabilityZone;
        const coreCount = resource.Instance.CpuOptions.CoreCount;
        const threadsPerCore = resource.Instance.CpuOptions.ThreadsPerCore;
        let instanceName = '';
        if ( resource.Tags ){
            for ( let nameTag of resource.Tags ){
                if ( nameTag.Key === "Name" ){
                    instanceName = nameTag.Value;
                }
            }
        }
        let auxdata = ""
        if ( config.CustomEC2TagKeys && config.CustomEC2TagKeys.length > 0){
            let tags = resource.Tags;
            for ( const tag of tags ){
                if ( config.CustomEC2TagKeys.indexOf(tag.Key) > -1 ){
                    auxdata += ` ${tag.Key}=${tag.Value}`
                }
            }
        }



        let markDown = `### Instance${auxdata} [${instanceId}](https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#InstanceDetails:instanceId=${instanceId}) ${instanceName} ${instanceType}${burstmodeLabel}/${instanceAz}/Cores:${coreCount}/ThreadsPC:${threadsPerCore}`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 2
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
            })],
            right: [new Metric({
                namespace: this.namespace,
                metricName: 'EBSWriteOps',
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
            width: 12,
            height: 5
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
            width: 6,
            height: 5,
            leftYAxis:{
                min: 0,
                max: 100
            }
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
            width: 6,
            height: 5
        });
        this.widgetSet.push(new Row(cpuwidget,networkWidget,widget));

        if ( burstable ){
            const CPUCreditUsageMetric = new Metric({
                namespace: this.namespace,
                metricName: 'CPUCreditUsage',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });
            const CPUCreditBalanceMetric = new Metric({
                namespace: this.namespace,
                metricName: 'CPUCreditBalance',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const CPUSurplusCreditBalance = new Metric({
                namespace: this.namespace,
                metricName: 'CPUSurplusCreditBalance',
                dimensionsMap: {
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const CPUSurplusCreditsCharged = new Metric({
                namespace: this.namespace,
                metricName: 'CPUSurplusCreditsCharged',
                dimensionsMap:{
                    InstnaceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const CPUSurplusCreditBalanceAlarm = CPUSurplusCreditBalance.createAlarm(this,`${instanceId}-CPUCredit-Alarm`,{
                alarmName: `${instanceId}-CPUCredit-Alarm`,
                treatMissingData: TreatMissingData.NOT_BREACHING,
                datapointsToAlarm: 1,
                evaluationPeriods: 1,
                threshold: 1
            });

            this.alarmSet.push(CPUSurplusCreditBalanceAlarm);

            const creditWidget = new GraphWidget({
                title: 'CpuCredits Usage/Balance',
                left: [CPUCreditUsageMetric],
                right: [CPUCreditBalanceMetric],
                period: Duration.minutes(1),
                region: region,
                width:12,
                height: 5
            });

            const surplusWidget = new GraphWidget({
                title: 'CPUSurplusCredit Balance/Charged',
                left:[CPUSurplusCreditBalance],
                right:[CPUSurplusCreditsCharged],
                period: Duration.minutes(1),
                region: region,
                width: 12,
                height: 5
            });
            this.widgetSet.push(new Row(creditWidget,surplusWidget));
        }

        if ( resource.CWAgent && resource.CWAgent === "True"){
            const memusedMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'mem_used_percent',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const cpuIowaitMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'cpu_usage_iowait',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const netstatEstablishedMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'netstat_tcp_established',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const netstatTcpWaitMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'netstat_tcp_time_wait',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const diskUsedPercentMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'disk_used_percent',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const swapUsedPercentMetric = new Metric({
                namespace: 'CWAgent',
                metricName: 'swap_used_percent',
                dimensionsMap:{
                    InstanceId: instanceId
                },
                period: Duration.minutes(1)
            });

            const memoryUsageCpuIoWaitWidget = new GraphWidget({
                title: 'MemoryUsed Percent/CPU Iowait',
                left:[memusedMetric],
                right:[cpuIowaitMetric],
                period: Duration.minutes(1),
                region: region,
                width: 12,
                height: 5
            });

            const networkConnWidget = new GraphWidget({
                title: 'TCP Established / TCP Time Wait',
                left:[netstatEstablishedMetric],
                right:[netstatTcpWaitMetric],
                period: Duration.minutes(1),
                region: region,
                width: 6,
                height: 5
            });

            const diskUtilWidget = new GraphWidget({
                title: 'Disk used / Swap used percent',
                left:[diskUsedPercentMetric],
                right:[swapUsedPercentMetric],
                period: Duration.minutes(1),
                region: region,
                width: 6,
                height: 5,
                leftYAxis:{
                    min: 0,
                    max: 100
                },
                rightYAxis:{
                    min: 0,
                    max: 100
                }
            });

            this.widgetSet.push(new Row(memoryUsageCpuIoWaitWidget,networkConnWidget,diskUtilWidget));
        }

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
