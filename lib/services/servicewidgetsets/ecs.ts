import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";

export class EcsWidgetSet extends Construct implements WidgetSet {
    namespace:string = "AWS/ECS";
    alarmSet:any = [];
    widgetSet:any = [];

    constructor(scope: Construct , id: string, resource:any) {
        super(scope,id);



    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}