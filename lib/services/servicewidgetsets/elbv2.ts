import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {NetworkELBWidgetSet} from "./netELB";
import {ApplicationELBWidgetSet} from "./appELB";
import {networkInterfaces} from "os";

export class ELBv2WidgetSet extends Construct implements WidgetSet {
    namespace:string = 'AWS/ELB'
    widgetSet:any = []
    alarmSet:any = []

    constructor(scope: Construct, id: string, resource:any) {
        super(scope,id);

        const elbName = resource.Extras.LoadBalancerName
        const region = resource.ResourceARN.split(':')[3];
        const type = resource.Extras.Type

        if ( type === "network"){
            const networkWidgetSet = new NetworkELBWidgetSet(scope,'ELB' + elbName, resource);
            for ( let widget of networkWidgetSet.getWidgetSets()){
                this.widgetSet.push(widget);
            }
            for ( let alarm of networkWidgetSet.getAlarmSet()) {
                this.alarmSet.push(alarm);
            }
        }

        if ( type === "application"){
            const applicationWidgetSet = new ApplicationELBWidgetSet(scope,'ALB' + elbName, resource);
            for ( let widget of applicationWidgetSet.getWidgetSets()){
                this.widgetSet.push(widget);
            }
            for ( let alarm of applicationWidgetSet.getAlarmSet()) {
                this.alarmSet.push(alarm);
            }
        }

    }


    getWidgetSets(): [] {
        return this.widgetSet
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}