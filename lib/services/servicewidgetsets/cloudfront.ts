import {IWidgetSet, WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Row, TextWidget} from "aws-cdk-lib/aws-cloudwatch";

export class CloudfrontWidgetSet extends Construct implements IWidgetSet {
    namespace: string = 'AWS/CloudFront';
    widgetSet: any = [];
    alarmSet: any = [];
    config:any = {};


    constructor(scope: Construct, id: string, resource: any, config:any) {
        super(scope, id);
        this.config = config;
        const distId = resource['Id'];
        const domainName = resource['DomainName'];
        const aliases = resource['Aliases']['Quantity']
        const origins = resource['Origins']['Quantity']

        let markDown = `### Distribution [${distId}](https://us-east-1.console.aws.amazon.com/cloudfront/v3/home?region=eu-west-1#/distributions/${distId}) ${domainName} Aliases: ${aliases} Origins: ${origins}`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 2
        }));

        const requestsMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Requests',
            dimensionsMap:{
                DistributionId: distId,
                Region: 'Global'
            }
        });

        const bytesDownMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesDownloaded',
            dimensionsMap:{
                Region: 'Global',
                DistributionId: distId
            }
        });

        const bytesUpMetric = new Metric({
            namespace: this.namespace,
            metricName: 'BytesUploaded',
            dimensionsMap:{
                Region: 'Global',
                DistributionId: distId
            }
        });

        const err4xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '4xxErrorRate',
            dimensionsMap:{
                Region: 'Global',
                DistributionId: distId
            }
        });

        const err5xxMetric = new Metric({
            namespace: this.namespace,
            metricName: '5xxErrorRate',
            dimensionsMap:{
                Region: 'Global',
                DistributionId: distId
            }
        });


        const requestWidget = new GraphWidget({
            title: 'Traffic',
            left: [requestsMetric],
            width: 12,
            region: 'us-east-1'
        });

        const dataWidget = new GraphWidget({
            title: 'Data',
            left: [bytesDownMetric],
            right: [bytesUpMetric],
            width: 6,
            region: 'us-east-1'
        });

        const errorWidget = new GraphWidget({
            title: 'Errors',
            left: [err4xxMetric],
            right:[err5xxMetric],
            width: 6,
            region: 'us-east-1'
        });
        this.widgetSet.push(new Row(requestWidget,dataWidget,errorWidget));

    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }
}