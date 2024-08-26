import {Dashboard, IWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Construct} from "constructs";
import {WidgetSet} from "./servicewidgetsets/widgetset";

interface DashboardManagerState {
    currentDashboard: Dashboard;
    currentWidgetCount: number;
    sequence: number;
}

export class DashboardManager {
    private state: DashboardManagerState;
    private readonly maxWidgetsPerDashboard: number;

    constructor(private scope: Construct, private id: string, maxWidgetsPerDashboard: number) {
        this.state = {
            currentDashboard: new Dashboard(scope, `${id}-dashboard-0`,{
                dashboardName: `${id}-dashboard`
            }),
            currentWidgetCount: 0,
            sequence: 0,
        };
        this.maxWidgetsPerDashboard = maxWidgetsPerDashboard;
        //console.log(`DashboardManager constructor max widgets ${maxWidgetsPerDashboard}`);
    }

    private ensureCapacityForWidgetSet(widgetSet: WidgetSet): Dashboard {
        const widgetCount = widgetSet.getWidgetCount();
        //console.log(`EnsureCapacityForWidgets, max is ${this.maxWidgetsPerDashboard} `);
        //console.log(`Got widgetCount to add = ${widgetCount}`);

        if (this.state.currentWidgetCount + widgetCount > this.maxWidgetsPerDashboard) {
            // Increment the sequence and create a new dashboard
            //console.log(`Seems we need new dashboard to overflow because ${this.state.currentWidgetCount + widgetCount} is more than ${this.maxWidgetsPerDashboard}`)
            this.state.sequence += 1;
            const newDashboardId = `${this.id}-dashboard-${this.state.sequence}`;
            this.state.currentDashboard = new Dashboard(this.scope, newDashboardId,{
                dashboardName: newDashboardId,
            });
            this.state.currentWidgetCount = 0;
        }

        this.state.currentWidgetCount += widgetCount;
        return this.state.currentDashboard;
    }

    private ensureCapacityForSingleWidget(){
        if (this.state.currentWidgetCount + 1 > this.maxWidgetsPerDashboard) {
            // Increment the sequence and create a new dashboard
            //console.log(`Seems we need new dashboard to overflow because ${this.state.currentWidgetCount + 1} is more than ${this.maxWidgetsPerDashboard}`)
            this.state.sequence += 1;
            const newDashboardId = `${this.id}-dashboard-${this.state.sequence}`;
            this.state.currentDashboard = new Dashboard(this.scope, newDashboardId,{
                dashboardName: newDashboardId,
            });
            this.state.currentWidgetCount = 0;
        }

        this.state.currentWidgetCount = 0;
        return this.state.currentDashboard;
    }

    public addWidgetSet(widgetSet: WidgetSet): void {
        const dashboard = this.ensureCapacityForWidgetSet(widgetSet);
        dashboard.addWidgets(...widgetSet.getWidgetSets());
    }

    public addWidget(widget:IWidget){
        const dashboard = this.ensureCapacityForSingleWidget();
        dashboard.addWidgets(widget);
    }

    public getSequence():number{
        return this.state.sequence;
    }


}