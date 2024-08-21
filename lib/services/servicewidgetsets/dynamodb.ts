import {GraphWidget, MathExpression, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class DynamodbWidgetSet extends Construct implements IWidgetSet{
    namespace:string = 'AWS/DynamoDB';
    static namespace:string = 'AWS/DynamoDB';

    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {}

    constructor(scope:Construct, id:string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        let arn = resource.ResourceARN;
        let type = resource.type;
        let tablename = arn.split('/')[arn.split('/').length - 1];
        let region = arn.split(':')[3];
        const accountMaxTableLevelWrites = new Metric({
            namespace: this.namespace,
            metricName: 'AccountMaxTableLevelWrites'
        })

        const maxProvisionedTableWriteCapacityUtilization = new Metric({
            namespace: '.',
            metricName: 'MaxProvisionedTableWriteCapacityUtilization'
        })


        const writesExpression = new MathExpression({
            label: "PercentageOfWrites",
            expression: "usedWrites/accountWrites*100",
            usingMetrics: {
                accountWrites: accountMaxTableLevelWrites,
                usedWrites: maxProvisionedTableWriteCapacityUtilization
            }
        })

        const writesAlarm = writesExpression.createAlarm(this,`Writes-${tablename}-${region}-${this.config.BaseName}`,{
            alarmName: `Writes-${tablename}-${region}-${this.config.BaseName}`,
            evaluationPeriods: 2,
            threshold: 90,
            datapointsToAlarm: 2,
            treatMissingData: TreatMissingData.NOT_BREACHING
        })

        this.alarmSet.push(writesAlarm);

        const widget = new GraphWidget({
            title: 'Consumed RCU '+tablename + ' (' + type + ')',
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: {
                    TableName: tablename
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'ProvisionedReadCapacityUnits',
                dimensionsMap: {
                    TableName: tablename
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width:12
        })
        const widget2 = new GraphWidget({
            title: 'Consumed WCU '+tablename + ' (' + type + ')' ,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: {
                    TableName: tablename
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            }),new Metric({
                namespace: this.namespace,
                metricName: 'ProvisionedWriteCapacityUnits',
                dimensionsMap: {
                    TableName: tablename
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width:12
        })
        this.widgetSet.push(new Row(widget,widget2));
    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    static getOverallWidget(){
        return new GraphWidget({
            title: 'RCU/WCU tot util',
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'MaxProvisionedTableReadCapacityUtilization',
                statistic: Statistic.AVERAGE,
            }),new Metric({
                namespace: this.namespace,
                metricName: 'MaxProvisionedTableWriteCapacityUtilization',
                statistic: Statistic.AVERAGE
            }),new Metric({
                namespace: this.namespace,
                metricName: 'AccountMaxTableLevelReads',
                statistic: Statistic.AVERAGE
            }),new Metric({
                namespace: this.namespace,
                metricName: 'AccountMaxTableLevelWrites',
                statistic: Statistic.AVERAGE
            })],
            width:24
        });
    }

}
