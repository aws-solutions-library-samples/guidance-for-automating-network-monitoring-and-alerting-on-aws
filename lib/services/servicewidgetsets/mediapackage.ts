import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic,TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class MediaPackageWidgetSet extends Construct implements IWidgetSet{
    widgetSet:any = [];
    namespace:string = 'AWS/MediaPackage'
    alarmSet:any = [];

    constructor(scope:Construct, id:string, resource:any, config:any) {
        super(scope, id);
        let ChannelId = resource.Id;
        let ingestendpoints = resource.IngestEndpoint;
        let OriginEndpoints = resource.OriginEndpoint;
        let region = resource.ResourceARN.split(':')[3];

        let markDown = "**MediaPackage Channel  [" + ChannelId + '](https://'+region+'.console.aws.amazon.com/mediapackage/home?region='+region+'#/channels/'+ChannelId+')**';
        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }))
        
        let ingressBytes = [];
        let ingressResponseTime = [];
        let egressResponseTime = [];
        let egressBytes = [];
        let egressRequestCount = [];
        
        for (let ingestendpoint of ingestendpoints){
            let ingestendpointId = ingestendpoint.Id;
            let metricIngressBytes =new Metric({
                    namespace: this.namespace,
                    metricName: 'IngressBytes',
                    dimensionsMap: {
                            Channel: ChannelId,
                            IngestEndpoint: ingestendpointId
                    },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                
            });
            ingressBytes.push(metricIngressBytes);
            let metricIngressResponseTime =new Metric({
                    namespace: this.namespace,
                    metricName: 'IngressResponseTime',
                    dimensionsMap: {
                            Channel: ChannelId,
                            IngestEndpoint: ingestendpointId
                    },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                
            });
            ingressResponseTime.push(metricIngressResponseTime);
        }
        
        for (let originendpoint of OriginEndpoints){
            let originendpointId = originendpoint.Id;
            let metricEgressResponseTime = new Metric({
                namespace: this.namespace,
                metricName: 'EgressResponseTime',
                        dimensionsMap: {
                            Channel: ChannelId,
                            OriginEndpoint: originendpointId
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
                egressResponseTime.push(metricEgressResponseTime);
        }
        for (let originendpoint of OriginEndpoints){
            let originendpointId = originendpoint.Id;
            let metricEgressBytes = new Metric({
                namespace: this.namespace,
                metricName: 'EgressBytes',
                        dimensionsMap: {
                            Channel: ChannelId,
                            OriginEndpoint: originendpointId
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
                egressBytes.push(metricEgressBytes);
        }
        for (let originendpoint of OriginEndpoints){
            let originendpointId = originendpoint.Id;
            let metricEgressequestCount2xx = new Metric({
                namespace: this.namespace,
                metricName: 'EgressRequestCount',
                        dimensionsMap: {
                             StatusCodeRange: '2xx'
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
        let metricEgressequestCount3xx = new Metric({
                namespace: this.namespace,
                metricName: 'EgressRequestCount',
                        dimensionsMap: {
                             StatusCodeRange: '3xx'
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
        let metricEgressequestCount4xx = new Metric({
                namespace: this.namespace,
                metricName: 'EgressRequestCount',
                        dimensionsMap: {
                             StatusCodeRange: '4xx'
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
        let metricEgressequestCount5xx = new Metric({
                namespace: this.namespace,
                metricName: 'EgressRequestCount',
                        dimensionsMap: {
                             StatusCodeRange: '5xx'
                        },
                    statistic: Statistic.SUM,
                    period:Duration.minutes(1)
                    
        });
                egressRequestCount.push(metricEgressequestCount2xx,metricEgressequestCount3xx,metricEgressequestCount4xx,metricEgressequestCount5xx,);
        }
        const IngressBytes = new GraphWidget({
            title: 'Ingress Bytes: Sum ',
            region: region,
                left: ingressBytes,
                width: 12
        });
        const IngressResponseTime = new GraphWidget({
            title: 'Ingress Response Time ',
            region: region,
                right: ingressResponseTime,
                width: 12
        });
        const EgressResponseTime = new GraphWidget({
            title: 'Egress Response Time ',
            region: region,
                right: egressResponseTime,
                width: 8
        });
        const EgressBytes = new GraphWidget({
            title: 'Egress Response Time ',
            region: region,
                left: egressBytes,
                width: 8
        });
        const EgressRequestCount = new GraphWidget({
            title: 'Egress Request Count ',
            region: region,
                right: egressRequestCount,
                width: 8
        });
        this.widgetSet.push(new Row(IngressBytes,IngressResponseTime,EgressBytes,EgressResponseTime,EgressRequestCount));
    }
    

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
