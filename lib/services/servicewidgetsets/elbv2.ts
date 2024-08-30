import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {NetworkELBWidgetSet} from "./netELB";
import {ApplicationELBWidgetSet} from "./appELB";

export class ELBv2WidgetSet extends WidgetSet implements IWidgetSet {
    namespace:string = 'AWS/ELB'
    widgetSet:any = []
    alarmSet:any = [];
    config:any = {};

    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope,id);
        this.config = config;
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
        const networkWidgetSet = new NetworkELBWidgetSet(scope, `NLB-${elbName}-${region}-${this.config.BaseName}`, resource, this.config);
        this.addWidgetRow(...networkWidgetSet.getWidgetSets());
        this.alarmSet.push(...networkWidgetSet.getAlarmSet());
    }

    private handleApplicationELB(scope: Construct ,resource: any) {
        const elbName = resource.Extras.LoadBalancerName;
        const region = resource.ResourceARN.split(':')[3];
        const applicationWidgetSet = new ApplicationELBWidgetSet(scope, `ALB-${elbName}-${region}-${this.config.BaseName}`, resource, this.config);
        this.addWidgetRow(...applicationWidgetSet.getWidgetSets());
        this.alarmSet.push(...applicationWidgetSet.getAlarmSet());
    }

    getWidgetSets(): [] {
        return this.widgetSet
    }

    getAlarmSet(): [] {
        return this.alarmSet
    }
}