/***
 * Each WidgetSet creates a set of dashboard widgets that belong to one resource.
 * In certain situations, it makes more sense to group resources like EC2 instances for a high overview,
 * OnDemand Capacity Reservations or Alarms.
 */

export interface WidgetSet{
    namespace:string;
    widgetSet:any[];
    alarmSet:any[];
    getWidgetSets():[];
    getAlarmSet():[];
}
