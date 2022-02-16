import {GraphWidget, IWidget, Metric, Statistic, Row} from "aws-cdk-lib/aws-cloudwatch";
import {WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class AppsyncWidgetSet extends Construct implements WidgetSet{
    namespace:string = 'AWS/AppSync';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id:string, arn:string) {
        super(scope, id);
        let graphqlendpoint = arn.split('/')[arn.split('/').length-1];
        let region = arn.split(':')[3];
        const widget = new GraphWidget({
            title: 'TotalRequests '+graphqlendpoint,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: '4XXErrors',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SAMPLE_COUNT,
                period:Duration.minutes(1)
            })],
        })
        const widget2 = new GraphWidget({
            title: 'Errors '+graphqlendpoint,
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: '4XXErrors',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SUM
            }),new Metric({
                namespace: this.namespace,
                metricName: '5XXErrors',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 9
        })

        const latencywidget = new GraphWidget({
            title: 'Latency '+graphqlendpoint,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Latency',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.MAXIMUM,
                period:Duration.minutes(1)
            })],
            width: 9
        })
        let rowwidget = new Row(widget,widget2,latencywidget);
        //this.widgetset.push(widget);
        //this.widgetset.push(widget2);
        //this.widgetset.push(latencywidget);
        this.widgetSet.push(rowwidget);
    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
