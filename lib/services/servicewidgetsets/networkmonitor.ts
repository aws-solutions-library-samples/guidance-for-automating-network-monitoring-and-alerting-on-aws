import {IWidgetSet, WidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {Metric, Stats, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class NetworkMonitorWidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string = "AWS/NetworkMonitor";
    widgetCount:number = 0;


    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        const monitorName = resource.monitorName;
        const region = resource.ResourceARN.split(':')[3];
        const probes = resource.probes;
        for (const probe of probes) {
            const probeName = probe.probeId;
            const packetLossMetric = new Metric({
                namespace: this.namespace,
                metricName: 'PacketLoss',
                label: `${probeName} PacketLoss`,
                dimensionsMap: {
                    Monitor: monitorName,
                    Probe: probeName
                },
                statistic: Stats.SUM,
                period:Duration.minutes(1)
            });

            const rttMetric = new Metric({
                namespace: this.namespace,
                metricName: 'RTT',
                label: `${probeName} RTT`,
                dimensionsMap: {
                    Monitor: monitorName,
                    Probe: probeName
                },
                statistic: Stats.SUM,
                period:Duration.minutes(1)
            });

            const pktAlarm = packetLossMetric.createAlarm(this, `PKT-LOSS-${probeName}-${region}-${this.config.BaseName}`,{
                alarmName: `PKT-LOSS-${probeName}-${region}-${this.config.BaseName}-Alarm`,
                threshold: 10,
                alarmDescription: `Packet loss Alarm for ${probeName}`,
                datapointsToAlarm: 2,
                evaluationPeriods: 2,
                treatMissingData: TreatMissingData.NOT_BREACHING
            });

            const rttAlarm = rttMetric.createAlarm(this, `RTT-${probeName}-${region}-${this.config.BaseName}`,{
                alarmName: `RTT-${probeName}-${region}-${this.config.BaseName}-Alarm`,
                threshold: 50000,
                alarmDescription: `Packet loss Alarm for ${probeName}`,
                datapointsToAlarm: 2,
                evaluationPeriods: 2,
                treatMissingData: TreatMissingData.NOT_BREACHING
            });

            this.alarmSet.push(pktAlarm,rttAlarm);

        }
    }

}
/***
[ "AWS/NetworkMonitor", "HealthIndicator", "Monitor", "EMEALab_Stack57_Monitor", "Probe", "probe-1418fv6mkaaykp5vm874is561" ],
    [ "...", "probe-42ljuh8b5deet50tiztsbig2y" ],
    [ "...", "probe-95w0l1vd47jxa2rpnajd8j6r7", { "period": 3600 } ],
    [ "...", "probe-cyai2bdcwmrbys17e36mz9m6c" ],
    [ ".", "PacketLoss", ".", ".", ".", "." ],
    [ ".", "RTT", ".", ".", ".", ".", { "yAxis": "right" } ],
    [ "...", "probe-1418fv6mkaaykp5vm874is561", { "yAxis": "right" } ],
    [ ".", "PacketLoss", ".", ".", ".", "." ],
    [ ".", "RTT", ".", ".", ".", "probe-95w0l1vd47jxa2rpnajd8j6r7", { "yAxis": "right" } ],
    [ ".", "PacketLoss", ".", ".", ".", ".", { "yAxis": "left" } ],
    [ "...", "probe-42ljuh8b5deet50tiztsbig2y" ],
    [ ".", "RTT", ".", ".", ".", ".", { "yAxis": "right" } ]

 */