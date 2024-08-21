import {IWidgetSet} from "./widgetset";
import {Construct} from "constructs";
import {GraphWidget, Metric, Row, Statistic, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class CapacityReservationsWidgetSet extends Construct implements IWidgetSet{
    namespace:string = 'AWS/EC2CapacityReservations';
    widgetSet:any = [];
    alarmSet: any = [];
    config:any = {};


    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        let usedMetricsArray = [];
        let availMetricsArray = [];
        const region = resource[0].ResourceARN.split(':')[3];
        for (const odcr of resource) {
            const arn = odcr.ResourceARN;
            const crId = arn.split('/')[arn.split('/').length-1];
            let usedMetric = new Metric({
                label: crId,
                namespace: this.namespace,
                metricName: 'UsedInstanceCount',
                dimensionsMap:{
                    CapacityReservationId: crId
                },
                region: region,
                statistic: Statistic.MAXIMUM,
                period: Duration.minutes(1)
            });
            let availableMetric = new Metric({
                label: crId,
                namespace: this.namespace,
                metricName: 'AvailableInstanceCount',
                dimensionsMap:{
                    CapacityReservationId: crId
                },
                region: region,
                statistic: Statistic.MAXIMUM,
                period: Duration.minutes(1)
            })

            let availableAlarm = availableMetric.createAlarm(this,`${crId}-${this.config.BaseName}`,{
                alarmName: `Alarm-UnusedODCR-${crId}-${this.config.BaseName}`,
                datapointsToAlarm: 1,
                evaluationPeriods: 1,
                threshold: 1,
                treatMissingData: TreatMissingData.NOT_BREACHING
            })

            this.alarmSet.push(availableAlarm);

            usedMetricsArray.push(usedMetric);
            availMetricsArray.push(availableMetric)
        }

        const capWidget = new GraphWidget({
            title: 'Capacity Reservations',
            left: usedMetricsArray,
            right: availMetricsArray,
            region: region,
            statistic: Statistic.SAMPLE_COUNT,
            width: 24
        })

        this.widgetSet.push(new Row(capWidget))




    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }



    getAlarmSet(): [] {
        return this.alarmSet;
    }
}