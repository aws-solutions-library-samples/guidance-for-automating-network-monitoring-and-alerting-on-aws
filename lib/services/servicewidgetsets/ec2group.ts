import {
    GraphWidget,
    MathExpression,
    Metric,
    Row,
    Statistic,
    TextWidget,
    TreatMissingData
} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class Ec2InstanceGroupWidgetSet extends Construct implements WidgetSet {
    namespace:string='AWS/EC2';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource:any) {
        super(scope, id)
        let region = resource[0].ResourceARN.split(':')[3];
        this.widgetSet.push(new TextWidget({
            markdown: "**EC2 instances in " + region +'**',
            width: 24,
            height: 1
        }))
        let ebsWriteMetricArray = this.getMetricArray(resource,'EBSWriteOps');
        const ebsWriteBytesWidget = new GraphWidget({
            title: 'EBSWriteOps',
            region: region,
            left: ebsWriteMetricArray,
            width: 12
        });
        let ebsReadMetricArray = this.getMetricArray(resource,'EBSReadOps');
        const ebsReadBytesWidget = new GraphWidget({
            title: 'EBSReadOps',
            region: region,
            left: ebsReadMetricArray,
            width: 12
        });

        let cpuUtilMetricArray = this.getMetricArray(resource,'CPUUtilization',Duration.minutes(1),Statistic.MAXIMUM)
        const averageCpuMetric = new MathExpression({
            expression: "AVG(METRICS())",
            label: "AVG CPU",
            usingMetrics: {
            }
        })
        const cpuwidget = new GraphWidget({
            title: 'CPU Utilisation ',
            region: region,
            left: cpuUtilMetricArray,
            right: [averageCpuMetric],
            width: 12
        })

        const avgCpuAlarm = averageCpuMetric.createAlarm(this,'AvgEC2CpuAlarm-' + region,{
            alarmName: 'Average EC2 CPU (' + region + ')',
            alarmDescription: 'Average EC2 CPU is too high',
            threshold: 50,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING
        })

        let networkInMetricArray = this.getMetricArray(resource, 'NetworkIn',Duration.minutes(1),Statistic.MAXIMUM)
        let networkOUtMetricArray = this.getMetricArray(resource,'NetworkOut',Duration.minutes(1),Statistic.MAXIMUM)
        const netwidget = new GraphWidget({
            title: 'Network Utilisation',
            region: region,
            left: networkInMetricArray,
            right: networkOUtMetricArray,
            width: 12
        })

        this.alarmSet.push(avgCpuAlarm)
        this.widgetSet.push(new Row(cpuwidget,netwidget))
        this.widgetSet.push(new Row(ebsWriteBytesWidget,ebsReadBytesWidget));
    }

    private getMetricArray(instances:any,metric:string,period?:Duration,statistic?:Statistic){
        let metricarray:Metric[] = [];
        let metricperiod = Duration.minutes(1);
        let metricstatistic = Statistic.SUM
        if ( period ){
            metricperiod = period;
        }
        if ( statistic ){
            metricstatistic = statistic;
        }
        for (let instance of instances){
            let instanceId = instance.ResourceARN.split('/')[instance.ResourceARN.split('/').length - 1];
            metricarray.push(new Metric({
                namespace: this.namespace,
                metricName: metric,
                dimensionsMap: {
                    InstanceId: instanceId
                },
                statistic: metricstatistic,
                period:metricperiod
            }))
        }
        return metricarray;
    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(){
        return this.alarmSet;
    }

}
