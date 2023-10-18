import {WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Row, Statistic, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class EcsEC2WidgetSet extends Construct implements WidgetSet {
    namespace:string = 'AWS/ECS';
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {}


    constructor(scope: Construct, id: string, service:any, clusterName:string, config:any) {
        super(scope, id);
        this.config = config;
        console.log(`EC2 Service ${clusterName}`);
        const region = service.serviceArn.split(':')[3];
        const serviceName = service.serviceName;
        const runningTasks = service.runningCount;
        const instances = service.instances;
        let markDown = `***ECS EC2 Service [${serviceName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}/services/${serviceName}/details) [${clusterName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}/services) Tasks: ${runningTasks}***`;
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

        const CPUUEc2tilisationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName,
                ServiceName: serviceName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const CPUEC2UtilAlarm = CPUUEc2tilisationMetric.createAlarm(this,`CPUUtilisationAlarm-${clusterName}-${serviceName}-${this.config.BaseName}`,{
            alarmName:`CPUUtilisationAlarm-${clusterName}-${serviceName}-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            threshold: 95,
            treatMissingData: TreatMissingData.MISSING
        });
        this.alarmSet.push(CPUEC2UtilAlarm);


        const MemoryEc2UtilizationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName,
                ServiceName: serviceName
            },
            period: Duration.minutes(1),
            statistic: Statistic.AVERAGE
        });

        const ServiceEc2CPUUtilisation = new GraphWidget({
            title: 'CPU/Memory Utilisation',
            region: region,
            left: [CPUUEc2tilisationMetric],
            right: [MemoryEc2UtilizationMetric],
            width: 24
        });

        this.widgetSet.push(new Row(ServiceEc2CPUUtilisation));

        for ( let instance of instances ){
            let markDown = `*Instance [${instance}](https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#InstanceDetails:instanceId=${instance})*`
            this.widgetSet.push(new TextWidget({
                markdown: markDown,
                width: 24,
                height: 1
            }));
            this.widgetSet.push(this.getInstanceWidget(instance,region));

        }



    }

    /***
     * Gets a widget row for each of the ClusterInstances
     * @param instanceId
     * @param region
     */
    getInstanceWidget(instanceId:string,region:string){
        const namespace:string = 'AWS/EC2';
        const cpuMetric = new Metric({
            namespace: namespace,
            metricName: 'CPUUtilization',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.MAXIMUM,
            period:Duration.minutes(1)
        });

        const cpuAlarm = cpuMetric.createAlarm(this,`CPUAlarm-ECS-${instanceId}-${this.config.BaseName}`,{
            alarmName:`CPUAlarm-ECS-${instanceId}-${this.config.BaseName}`,
            treatMissingData: TreatMissingData.MISSING,
            threshold: 95,
            datapointsToAlarm: 3,
            evaluationPeriods: 3
        });

        this.alarmSet.push(cpuAlarm);

        const networkInMetric = new Metric({
            namespace: namespace,
            metricName: 'NetworkIn',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.MAXIMUM,
            period:Duration.minutes(1)
        });

        const networkOutMetric = new Metric({
            namespace: namespace,
            metricName: 'NetworkOut',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.MAXIMUM,
            period:Duration.minutes(1)
        });

        const ebsWriteBytes = new Metric({
            namespace: namespace,
            metricName: 'EBSWriteBytes',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const ebsReadBytes = new Metric({
            namespace: namespace,
            metricName: 'EBSReadBytes',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const ebsWriteOps = new Metric({
            namespace: this.namespace,
            metricName: 'EBSWriteOps',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });

        const ebsReadOps = new Metric({
            namespace: namespace,
            metricName: 'EBSReadOps',
            dimensionsMap: {
                InstanceId: instanceId
            },
            statistic: Statistic.SUM,
            period:Duration.minutes(1)
        });


        const ebsReadWriteBytesWidget = new GraphWidget({
            title: 'EBS r/w Bytes',
            region: region,
            left: [ebsReadBytes],
            right: [ebsWriteBytes],
            width: 6,
            height: 3
        });

        const ebsReadWriteOpsWidget = new GraphWidget({
            title: 'EBS r/w Ops',
            region: region,
            left: [ebsReadOps],
            right: [ebsWriteOps],
            width: 6,
            height: 3
        });

        const networkInOutWidget = new GraphWidget({
            title: 'Network in/out',
            region: region,
            left:[networkInMetric],
            right:[networkOutMetric],
            width: 6,
            height: 3
        });

        const cpuwidget = new GraphWidget({
            title: 'CPU '+instanceId,
            region: region,
            left: [cpuMetric],
            width: 6,
            height: 3
        });

        return new Row(cpuwidget,networkInOutWidget,ebsReadWriteBytesWidget,ebsReadWriteOpsWidget);
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}