import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Stats, TextWidget, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import { MaximumExecutionFrequency } from "aws-cdk-lib/aws-config";

export class R53ResolverWidgetSet extends Construct implements WidgetSet {
    namespace:string='AWS/Route53Resolver';
    widgetSet:any = [];
    alarmSet:any = [];

    constructor(scope: Construct, id: string, resource: any) {
        super(scope,id);
        const resolverId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        let markDown = `### Resolver Endpoint - ${resolverId}`
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

        const EndpointHealthyENICount = new Metric({
            namespace: this.namespace,
            metricName: 'EndpointHealthyENICount',
            dimensionsMap: {
                EndpointId: resolverId
            },
            statistic: Stats.MINIMUM,
            period:Duration.minutes(5)
        });

        const EndpointUnHealthyENICount = new Metric({
            namespace: this.namespace,
            metricName: 'EndpointUnhealthyENICount',
            dimensionsMap: {
                EndpointId: resolverId
            },
            statistic: Stats.MAXIMUM,
            period:Duration.minutes(5)
        });

        const eniHealthWidget = new GraphWidget({
            title: `ENI Health`,
            region: region,
            left: [EndpointHealthyENICount, EndpointUnHealthyENICount],
            width: 8
        });

        let rniArray = [];
        if (resource.ResolverType == "outbound"){
            for (let rni of resource.rnis){
                const OutboundQueryAggregateVolumeMetric = new Metric({
                    namespace: this.namespace,
                    metricName: 'OutboundQueryAggregateVolume', 
                    dimensionsMap: {
                        RniId: rni
                    }, 
                    statistic: Stats.SUM,
                    period:Duration.minutes(5)
                });
                rniArray.push(OutboundQueryAggregateVolumeMetric);
            }

            const OutBoundQueryVolumeMetric = new Metric({
                namespace: this.namespace,
                metricName: 'OutboundQueryVolume',
                dimensionsMap: {
                    EndpointId: resolverId
                },
                statistic: Stats.SUM,
                period:Duration.minutes(5)
            });

            const resolverOutboundQueryAggregateVolume = new Metric({
                namespace: this.namespace,
                metricName: 'OutboundQueryAggregateVolume',
                dimensionsMap: {
                    EndpointId: resolverId
                },
                statistic: Stats.SUM,
                period:Duration.minutes(5)
            });

            const eniQueryVolumeWidget = new GraphWidget({
                title: `Resolver Query Volumes ${resolverId}`,
                region: region,
                left: rniArray,
                right: [OutBoundQueryVolumeMetric, resolverOutboundQueryAggregateVolume],
                width: 16
            });

            this.widgetSet.push(new Row(eniHealthWidget, eniQueryVolumeWidget));
        }
        else {
            for (let rni of resource.rnis){
                const InboundQueryVolumeMetric = new Metric({
                    namespace: this.namespace,
                    metricName: 'InboundQueryVolume', 
                    dimensionsMap: {
                        RniId: rni
                    }, 
                    statistic: Stats.SUM,
                    period:Duration.minutes(5)
                });
                rniArray.push(InboundQueryVolumeMetric);
            }

            const resolverInboundQueryVolume = new Metric({
                namespace: this.namespace,
                metricName: 'InboundQueryVolume',
                dimensionsMap: {
                    EndpointId: resolverId
                },
                statistic: Stats.SUM,
                period:Duration.minutes(5)
            });

            const eniQueryVolumeWidget = new GraphWidget({
                title: `Resolver Query Volumes ${resolverId}`,
                right: [resolverInboundQueryVolume],
                left: rniArray,
                width: 16
            });

            this.widgetSet.push(new Row(eniHealthWidget, eniQueryVolumeWidget));
        }

        const EndpointUnhealthyAlarm = EndpointUnHealthyENICount.createAlarm(this, `${resolverId}-Unhealthy-ENI-Alarm`, {
            alarmName: `${resolverId}-Unhealthy-ENI-Alarm`,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            datapointsToAlarm: 1,
            evaluationPeriods: 1,
            threshold: 1
        })

        this.alarmSet.push(EndpointUnhealthyAlarm);
    }

        getWidgetSets(){
            return this.widgetSet;
        }

        getAlarmSet(): [] {
            return this.alarmSet;
        }      

}
