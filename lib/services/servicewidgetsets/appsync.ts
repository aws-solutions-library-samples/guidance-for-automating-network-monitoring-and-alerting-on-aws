import {GraphWidget, MathExpression, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {IWidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class AppsyncWidgetSet extends Construct implements IWidgetSet{
    namespace:string = 'AWS/AppSync';
    widgetSet:any = [];
    alarmSet:any = [];

    config:any = {}

    constructor(scope: Construct, id:string, resource:any, config:any) {
        super(scope, id);
        const arn = resource.ResourceARN;
        const name = resource.name;
        this.config = config;
        let graphqlendpoint = arn.split('/')[arn.split('/').length-1];
        let region = arn.split(':')[3];
        const widget = new GraphWidget({
            title: `TotalRequests ${name} ${graphqlendpoint}`,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: '4XXError',
                label: `Requests ${name} ${graphqlendpoint}`,
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SAMPLE_COUNT,
                period:Duration.minutes(1)
            })],
            width: 8
        })
        
        const widget2 = new GraphWidget({
            title: `Errors ${name} ${graphqlendpoint}`,
            stacked: true,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: '4XXError',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            right: [new Metric({
                namespace: this.namespace,
                metricName: '5XXError',
                dimensionsMap: {
                    GraphQLAPIId: graphqlendpoint
                },
                statistic: Statistic.SUM,
                period:Duration.minutes(1)
            })],
            width: 8
        })

        const latencyMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Latency',
            dimensionsMap: {
                GraphQLAPIId: graphqlendpoint
            },
            statistic: Statistic.MAXIMUM,
            period:Duration.minutes(1)
        });

        const latencywidget = new GraphWidget({
            title: `Latency ${name} ${graphqlendpoint}`,
            region: region,
            left: [latencyMetric],
            width: 8
        });

        const latencyAlarm = latencyMetric.createAlarm(this, `latencyMetric-alarm-${this.config.BaseName}`, {
            alarmName: `latencyMetric-alarm-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            threshold: 10,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.MISSING
        })

        this.widgetSet.push(new Row(widget,widget2,latencywidget));
        this.alarmSet.push(latencyAlarm)
    }

    getRegionalMetrics(region:string, scope:Construct, config:any){
        const requestMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Requests',
            dimensionsMap:{
                Region: region
            },
            statistic: Statistic.SAMPLE_COUNT,
            period: Duration.minutes(1)
        });

        const consumedTokensMetric = new Metric({
            namespace: this.namespace,
            metricName: 'TokensConsumed',
            dimensionsMap:{
                Region: region
            },
            statistic: Statistic.SAMPLE_COUNT,
            period: Duration.minutes(1)
        })

        const tokensExpression = new MathExpression({
            expression: "tokens/requests",
            label:'Tokens per request',
            usingMetrics: {
                tokens: consumedTokensMetric,
                requests: requestMetric
            },
            period: Duration.minutes(1)
        });

        const requestWidget = new GraphWidget({
            title: `Requests ${region}`,
            region: region,
            left: [requestMetric],
            width: 8
        });

        const tokensConsumedWidget = new GraphWidget({
            title: `Tokens Consumed ${region}`,
            region: region,
            left: [consumedTokensMetric],
            width: 8
        });

        const tokenWidget = new GraphWidget({
            title: `Tokens used`,
            region: region,
            left: [tokensExpression],
            width: 8
        });

        const tokensAlarm = tokensExpression.createAlarm(scope,`TokensAlarm-Appsync-${config.BaseName}`,{
            datapointsToAlarm: 2,
            threshold: 1.1,
            evaluationPeriods: 2,
            alarmName: `TokensAlarm-Appsync-${config.BaseName}`,
            treatMissingData: TreatMissingData.NOT_BREACHING
        });

        this.alarmSet.push(tokensAlarm);

        return new Row(requestWidget, tokensConsumedWidget, tokenWidget);
    }

    getWidgetSets(){
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
