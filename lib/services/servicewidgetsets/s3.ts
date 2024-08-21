import {IWidgetSet, WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class S3WidgetSet extends Construct implements IWidgetSet {
    alarmSet:any = [];
    namespace:string = 'AWS/S3';
    widgetSet:any = [];
    config:any = {};


    constructor(scope: Construct, id: string, resource: any, config:any) {
        super(scope, id);
        this.config = config;
        let arn = resource.ResourceARN;
        let bucketName = arn.split(":")[arn.split(':').length-1];
        let region = resource.Region;
        let markDown = `#### Bucket [${bucketName}](https://console.aws.amazon.com/s3/buckets/${bucketName}/)`
        if ( resource.Encryption ){
            markDown += ` Encrypted: ${resource.Encryption.Type}, BucketKeyEnabled: ${resource.Encryption.BucketKeyEnabled}`;
        } else {
            markDown += ` Not Encrypted`;
        }

        if ( region ){
            markDown += `, Region: ${region}`
        }


        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))


        const widget = new GraphWidget({
            title: 'Numberz of Objects '+bucketName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'NumberOfObjects',
                region: region,
                dimensionsMap: {
                    BucketName: bucketName,
                    StorageType: "AllStorageTypes"
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 8
        });


        const storageWidget = new GraphWidget({
            title: 'Total Storage',
            region: region,
            left:[new Metric({
                namespace: this.namespace,
                metricName: 'BucketSizeBytes',
                region: region,
                dimensionsMap: {
                    BucketName: bucketName,
                    StorageType: "StandardStorage"
                },
                statistic: Statistic.AVERAGE,
                period:Duration.minutes(1)
            })],
            width: 8
        });

        const requests = new GraphWidget({
            title: 'Requests',
            region: region,
            left:[new Metric({
                namespace: this.namespace,
                metricName: 'GetRequests',
                region: region,
                dimensionsMap: {
                    BucketName: bucketName
                },
                statistic: Statistic.SUM
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'PutRequests',
                region: region,
                dimensionsMap:{
                    BucketName: bucketName
                },
                statistic: Statistic.SUM
            }),new Metric({
                namespace: this.namespace,
                metricName: 'PostRequests',
                region: region,
                dimensionsMap:{
                    BucketName: bucketName
                },
                statistic: Statistic.SUM
            })],
            period: Duration.minutes(1),
            width: 8
        });
        this.widgetSet.push(new Row(widget,storageWidget,requests));

        // adding alarms if needed
        // this.alarmSet.push(new Alarm())
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

}