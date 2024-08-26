/***
 * Each WidgetSet creates a set of dashboard widgets that belong to one resource.
 * In certain situations, it makes more sense to group resources like EC2 instances for a high overview,
 * OnDemand Capacity Reservations or Alarms.
 */
import {Construct} from "constructs";
import {GraphWidget, Row} from "aws-cdk-lib/aws-cloudwatch";
import {ConcreteWidget} from "aws-cdk-lib/aws-cloudwatch/lib/widget";

export interface IWidgetSet{
    namespace:string;
    widgetSet:any[];
    alarmSet:any[];
    getWidgetSets():any[];
    getAlarmSet():any[];
}

export abstract class WidgetSet extends Construct implements IWidgetSet{
    namespace:string;
    widgetSet:any[];
    alarmSet:any[];
    widgetCount:number = 0;

    getAlarmSet(): any[] {
        return this.alarmSet;
    }

    getWidgetSets(): any[] {
        return this.widgetSet;
    }

    addWidgetRow(...widgets:ConcreteWidget[]){
        let count = 0
        let row = new Row();
        for (const widgetElement of widgets) {
            count += 1;
            row.addWidget(widgetElement);
        }
        this.widgetCount += count;
        this.widgetSet.push(row);
    }

    getWidgetCount(): number {
        return this.widgetCount;
    }
}
