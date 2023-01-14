import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {NetworkELBWidgetSet} from "./netELB";
import {ApplicationELBWidgetSet} from "./appELB";

export class ELBv2WidgetSet extends Construct implements WidgetSet {
    namespace:string = 'AWS/ELB'
    widgetSet:any = []
    alarmSet:any = []

    constructor(scope: Construct, id: string, resource:any) {
        super(scope,id);


        const type = resource.Extras.Type

        if ( type === "network"){
            this.handleNetworkELB(scope, resource);
        } else if ( type === "application"){
            this.handleApplicationELB(scope, resource);
        }

    }

    private handleNetworkELB(scope: Construct ,resource: any) {
        const elbName = resource.Extras.LoadBalancerName;
        const region = resource.ResourceARN.split(':')[3];
        const networkWidgetSet = new NetworkELBWidgetSet(scope, `NLB-${elbName}-${region}`, resource);
        this.widgetSet.push(...networkWidgetSet.getWidgetSets());
        this.alarmSet.push(...networkWidgetSet.getAlarmSet());
    }

    private handleApplicationELB(scope: Construct ,resource: any) {
        const elbName = resource.Extras.LoadBalancerName;
        const region = resource.ResourceARN.split(':')[3];
        const applicationWidgetSet = new ApplicationELBWidgetSet(scope, `ALB-${elbName}-${region}`, resource);
        this.widgetSet.push(...applicationWidgetSet.getWidgetSets());
        this.alarmSet.push(...applicationWidgetSet.getAlarmSet());
    }

    getWidgetSets(): [] {
        return this.widgetSet
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}