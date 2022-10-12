import {Alarm, AlarmProps, CfnAlarm, CfnAnomalyDetector, IAlarm, Statistic} from "aws-cdk-lib/aws-cloudwatch";
import {Construct} from "constructs";
import {IMetric} from "aws-cdk-lib/aws-cloudwatch/lib/metric-types";
import {Duration} from "aws-cdk-lib";
import DimensionProperty = CfnAnomalyDetector.DimensionProperty;

export interface AnomalyDetectorAlarmProps extends AlarmProps {
    /**
     * The metric to add the alarm on.
     *
     * Metric objects can be obtained from most resources, or you can construct
     * custom Metric objects by instantiating one.
     *
     * @stability stable
     */
    readonly metric: IMetric;
    readonly namespace: string;
    readonly metricName: string;
    readonly statistic: Statistic;
    readonly bandWidth?: number;
    readonly dimensions?:DimensionProperty[];
    readonly label?:string;
}


export class AnomalyDetectorAlarm extends Alarm{
    public alarm: IAlarm;
    bandWidth = 2;
    readonly alarmArn: string;
    readonly alarmName: string;
    readonly metric: IMetric;

    constructor(scope: Construct, id: string,props:AnomalyDetectorAlarmProps) {
        super(scope, id, props);
        id = id.replace(/-/g,'').toLowerCase();
        console.log(props);
        if ( props.bandWidth){
            this.bandWidth = props.bandWidth;
        }

        const anomalyDetector = new CfnAnomalyDetector(this, `${id}AnomalyDetector`, {
            namespace: props.namespace,
            metricName: props.metricName,
            stat: props.statistic,
            dimensions: props.dimensions
        });

        const anomalyAlarm = new CfnAlarm(this,`${id}AnomalyAlarm`,{
            actionsEnabled: props.actionsEnabled?props.actionsEnabled:false,
            alarmName: props.alarmName?props.alarmName:`AnomalyAlarm-${id}`,
            metrics:[{
                id: `${id}MetricExpression`,
                label: props.label?props.label:"Alarm",
                expression: `ANOMALY_DETECTION_BAND(m1, ${this.bandWidth})`,
                period: Duration.minutes(1).toSeconds()
            },{
                id: 'm1',
                metricStat:{
                    metric: {
                        metricName: anomalyDetector.metricName,
                        namespace: anomalyDetector.namespace,
                        dimensions: props.dimensions
                    },
                    period: Duration.minutes(1).toSeconds(),
                    stat: props.statistic?props.statistic:Statistic.AVERAGE
                }
            }],
            datapointsToAlarm: 1,
            treatMissingData: 'breaching',
            comparisonOperator: 'LessThanLowerOrGreaterThanUpperThreshold',
            evaluationPeriods: 1,
            thresholdMetricId: `${id}MetricExpression`
        });

        //console.log(anomalyAlarm)

        this.alarm = Alarm.fromAlarmArn(this, `AnomalyAlarm_${id}`, anomalyAlarm.attrArn);
        this.alarmArn = this.alarm.alarmArn;
        this.alarmName = this.alarm.alarmName;
    }

    getAlarm():IAlarm {
        return this.alarm;
    }

}