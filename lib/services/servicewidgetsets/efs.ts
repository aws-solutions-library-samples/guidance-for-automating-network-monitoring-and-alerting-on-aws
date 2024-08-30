import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Stats, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import { MaximumExecutionFrequency } from "aws-cdk-lib/aws-config";

export class EFSWidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string='AWS/EFS';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource: any) {
        super(scope,id);
        const fsName = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### EFS - ${fsName}`
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const permittedThrougput = new Metric({
            namespace: this.namespace,
            metricName: 'PermittedThroughput',
            dimensionsMap: {
                FileSystemId: fsName
            },
            statistic: Stats.MAXIMUM,
            period:Duration.minutes(1)
        });

        const meteredIOBytes = new Metric({
            namespace: this.namespace,
            metricName: 'MeteredIOBytes',
            dimensionsMap: {
                FileSystemId: fsName
            },
            statistic: Stats.SAMPLE_COUNT,
            period:Duration.minutes(1)
        });

        const clientConnections = new Metric({
            namespace: this.namespace,
            metricName: 'ClientConnections', 
            dimensionsMap: {
                FileSystemId: fsName
            }, 
            statistic: Stats.MAXIMUM,
            period:Duration.minutes(1)

        });

        const writeIOBytes = new Metric({
            namespace: this.namespace,
            metricName: 'DataWriteIOBytes', 
            dimensionsMap: {
                FileSystemId: fsName
            }, 
            statistic: Stats.SAMPLE_COUNT,
            period:Duration.minutes(1)

        });

        const readIOBytes = new Metric({
            namespace: this.namespace,
            metricName: 'DataReadIOBytes', 
            dimensionsMap: {
                FileSystemId: fsName
            }, 
            statistic: Stats.SAMPLE_COUNT,
            period:Duration.minutes(1)

        });

        const performanceWidget = new GraphWidget({
            title: `Throughput ${fsName}`,
            region: region,
            left: [permittedThrougput],
            right: [meteredIOBytes],
            width: 6
        });

        const clientWidget = new GraphWidget({
            title: `Client Connections ${fsName}`,
            region: region,
            left: [clientConnections],
            width: 6
        });


        const readWriteIOWidget = new GraphWidget({
            title: `Read/Write IO Bytes ${fsName}`,
            region: region,
            left: [readIOBytes],
            right: [writeIOBytes],
        });

        if (resource.ThroughputMode == "bursting" || resource.ThroughputMode == "provisioned"){
            const burstCreditBalance = new Metric({
                namespace: this.namespace,
                metricName: 'BurstCreditBalance',
                dimensionsMap: {
                    FileSystemId: fsName
                },
                statistic: Stats.MINIMUM,
                period:Duration.minutes(1)
            });

            const burstCreditsWidget = new GraphWidget({
                title: `Burst Credits ${fsName}`,
                region: region,
                left: [burstCreditBalance],
                width: 6
            });

            this.addWidgetRow(performanceWidget, clientWidget, burstCreditsWidget, readWriteIOWidget);
        }
        else {
            this.addWidgetRow(performanceWidget, clientWidget,readWriteIOWidget);
        }

    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}