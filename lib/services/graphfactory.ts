import {
    AlarmStatusWidget,
    Dashboard,
    Spacer,
    TextWidget
} from "aws-cdk-lib/aws-cloudwatch";
import {AppsyncWidgetSet} from "./servicewidgetsets/appsync";
import {DynamodbWidgetSet} from "./servicewidgetsets/dynamodb";
import {Ec2InstancesWidgetSet} from "./servicewidgetsets/ec2instances";
import {LambdaWidgetSet} from "./servicewidgetsets/lambda";
import {ASGWidgetSet} from "./servicewidgetsets/autoscalinggroup";
import {ApiGatewayV1WidgetSet} from "./servicewidgetsets/apigatewayv1";
import {ApiGatewayV2WebSocketWidgetSet} from "./servicewidgetsets/apigatewayv2websocket";
import {ApiGatewayV2HttpWidgetSet} from "./servicewidgetsets/apigatewayv2http";
import {SQSWidgetSet} from "./servicewidgetsets/sqs";
import {AuroraWidgetSet} from "./servicewidgetsets/aurora";
import {Ec2InstanceGroupWidgetSet} from "./servicewidgetsets/ec2group";
import {Construct} from "constructs";
import {ELBv2WidgetSet} from "./servicewidgetsets/elbv2";
import {ELBv1WidgetSet} from "./servicewidgetsets/elbv1";
import {CapacityReservationsWidgetSet} from "./servicewidgetsets/capacityreservations";

export class GraphFactory extends Construct {
    serviceArray:any=[];
    widgetArray:any=[];
    EC2Dashboard:any = null;

    alarmSet:any = [];
    config:any;

    constructor(scope: Construct, id: string, resources:any[], config:any){
        super(scope,id);
        this.config = config;
        this.sortARNsByService(resources);
        let regions = Object.keys(this.serviceArray);
        for (let region of regions ){
            console.log('Processing region ' + region);
            this.widgetArray.push(new TextWidget({
                markdown: "# Region: " + region,
                width: 24,
                height: 1
            }))
            let servicekeys = Object.keys(this.serviceArray[region]);
            let resourcecounter = 0;
            for (let servicekey of servicekeys){
                console.log("Processing " + servicekey);
                switch(servicekey){
                    case "appsync": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## AppSync",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let appsync = new AppsyncWidgetSet(this,'AppsyncWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of appsync.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.widgetArray.push(new Spacer({width:24,height:2}));
                            resourcecounter += 1;
                        }
                        break;
                    }
                    case "apigatewayv1":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## API Gateway REST",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let apigw = new ApiGatewayV1WidgetSet(this, 'APIGWV1WidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widgetSet of apigw.getWidgetSets()) {
                                this.widgetArray.push(widgetSet);
                            }
                            this.alarmSet = this.alarmSet.concat(apigw.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }
                    case "apigatewayv2":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## API Gateway Websocket/HTTP",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let gw;
                            if (resource.type === "WEBSOCKET"){
                                gw = new ApiGatewayV2WebSocketWidgetSet(this, 'APIGWV2WebSocketWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            } else {
                                gw = new ApiGatewayV2HttpWidgetSet(this,'APIGWV2HTTPWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            }
                            for (const widgetSet of gw.getWidgetSets()){
                                this.widgetArray.push(widgetSet)
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "dynamodb":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## DynamoDB",
                            width: 24,
                            height: 1
                        }))
                        this.widgetArray.push(DynamodbWidgetSet.getOverallWidget());
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let table = new DynamodbWidgetSet(this, 'DynamoDBWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of table.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(table.getAlarmSet());
                            resourcecounter += 1;
                        }
                        this.widgetArray.push(new Spacer({width:24,height:2}));
                        break;
                    }

                    case "ec2instances":{
                        //We create the dashboard only if we actually have EC2s in the workload
                        if (!this.EC2Dashboard){
                            this.EC2Dashboard = new Dashboard(this,config.BaseName + '-EC2-Dashboard',{
                                dashboardName: config.BaseName + '-EC2-Dashboard'
                            });
                            this.EC2Dashboard.get
                        }
                        const labelWidget = new TextWidget({
                            markdown: "## EC2 Instances " + region,
                            width: 24,
                            height: 1
                        })
                        this.EC2Dashboard.addWidgets(labelWidget)
                        this.widgetArray.push(labelWidget)


                        //Push instances to new detail dashboard
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let instance = new Ec2InstancesWidgetSet(this, 'EC2InstancesWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of instance.getWidgetSets()){
                                this.EC2Dashboard.addWidgets(widget);
                                //this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;

                        }
                        //This is doubling the info from above. Push aggregated view to main dashboard.
                        let instancegroup = new Ec2InstanceGroupWidgetSet(this,'Ec2InstanceGroupWidgetSet' + this.getRandomString(6) + resourcecounter,this.serviceArray[region][servicekey])
                        for (const wdgt of instancegroup.getWidgetSets()){
                            this.widgetArray.push(wdgt);
                        }
                        this.alarmSet = this.alarmSet.concat(instancegroup.getAlarmSet())
                        this.widgetArray.push(new Spacer({width:24,height:2}));
                        break;
                    }
                    case "lambda":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Lambda Functions",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let lambdas = new LambdaWidgetSet(this,'LambdaWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of lambdas.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;
                        }
                        this.widgetArray.push(new Spacer({width:24,height:2}));
                        break;
                    }

                    case "autoscalinggroup":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Autoscaling groups",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let asg = new ASGWidgetSet(this,'ASGWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of asg.getWidgetSets()){
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;

                        }
                        this.widgetArray.push(new Spacer({width:24,height:2}));
                        break;
                    }

                    case "sqs":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## SQS Queues",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]){
                            let sqs = new SQSWidgetSet(this,'SQSWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of sqs.getWidgetSets()){
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "aurora":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Aurora",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]){
                            let aurora = new AuroraWidgetSet(this,'AuroraWidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of aurora.getWidgetSets()){
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "elbv2":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## ELB (app/net)",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]){
                            let elbv2 = new ELBv2WidgetSet(this,'ELBv2WidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of elbv2.getWidgetSets()){
                                console.log('GOT WIDGET FROM ELB2');
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(elbv2.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "elbv1":{
                        this.widgetArray.push(new TextWidget({
                            markdown: "## ELB Classic",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]){
                            let elbv1 = new ELBv1WidgetSet(this,'ELBv1WidgetSet' + this.getRandomString(6) + resourcecounter,resource);
                            for (const widget of elbv1.getWidgetSets()){
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(elbv1.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "odcr": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## On Demand Capacity Reservations",
                            width: 24,
                            height: 1
                        }));

                        const odcrs = new CapacityReservationsWidgetSet(this,'Capacity' + this.getRandomString(6) + resourcecounter, this.serviceArray[region][servicekey]);

                        for ( const widget of odcrs.getWidgetSets()){
                            this.widgetArray.push(widget);
                        }
                        this.alarmSet = this.alarmSet.concat(odcrs.getAlarmSet());
                        resourcecounter += 1;
                        break;
                    }

                    default: {
                        console.log("Error: not recognised service");
                        break;
                    }
                }
            }
        }
        const height = 1 + Math.floor(this.alarmSet.length/4) + (this.alarmSet.length%4!=0?1:0)
        const alarmStatusWidget = new AlarmStatusWidget({
            title: 'Alarms',
            width: 24,
            height: height,
            alarms: this.alarmSet
        })

        this.widgetArray = [alarmStatusWidget].concat(this.widgetArray)
    }


    /***
     * We are sorting by service for better overview on the dashboard
     * @param resources
     * @private
     */
    private sortARNsByService(resources: any[]) {
        for (let resource of resources) {
            let region = resource.ResourceARN.split(':')[3];
            if ( ! this.serviceArray[region]){
                this.serviceArray[region] = [];
            }
            if (resource.ResourceARN.includes('apigateway') && resource.ResourceARN.includes('restapis')) {
                if (!this.serviceArray[region]["apigatewayv1"]) {
                    this.serviceArray[region]["apigatewayv1"] = [resource];
                } else {
                    this.serviceArray[region]["apigatewayv1"].push(resource);
                }
            } else if (resource.ResourceARN.includes('apigateway') && resource.ResourceARN.includes('apis')) {
                if (!this.serviceArray[region]["apigatewayv2"]) {
                    this.serviceArray[region]["apigatewayv2"] = [resource];
                } else {
                    this.serviceArray[region]["apigatewayv2"].push(resource);
                }
            } else if (resource.ResourceARN.includes('appsync')) {
                if (!this.serviceArray[region]["appsync"]) {
                    this.serviceArray[region]["appsync"] = [resource.ResourceARN];
                } else {
                    this.serviceArray[region]["appsync"].push(resource.ResourceARN);
                }
            } else if (resource.ResourceARN.includes('dynamodb') && resource.ResourceARN.includes("table")) {
                if (!this.serviceArray[region]["dynamodb"]) {
                    this.serviceArray[region]["dynamodb"] = [resource];
                } else {
                    this.serviceArray[region]["dynamodb"].push(resource);
                }
            } else if (resource.ResourceARN.includes('ec2') && resource.ResourceARN.includes('instance')) {
                if (this.hasTagKey(resource.Tags,'aws:autoscaling:groupName')){
                }
                if (!this.serviceArray[region]["ec2instances"]) {
                    this.serviceArray[region]["ec2instances"] = [resource];
                } else {
                    this.serviceArray[region]["ec2instances"].push(resource);
                }
            } else if (resource.ResourceARN.includes('lambda') && resource.ResourceARN.includes('function')) {
                if (!this.serviceArray[region]["lambda"]) {
                    this.serviceArray[region]["lambda"] = [resource.ResourceARN];
                } else {
                    this.serviceArray[region]["lambda"].push(resource.ResourceARN);
                }
            } else if (resource.ResourceARN.includes('autoscaling') && resource.ResourceARN.includes('autoScalingGroup')) {
                if (!this.serviceArray[region]["autoscalinggroup"]){
                    this.serviceArray[region]["autoscalinggroup"] = [resource.ResourceARN];
                } else {
                    this.serviceArray[region]["autoscalinggroup"].push(resource.ResourceARN);
                }
            } else if (resource.ResourceARN.includes('sqs')){
                if (!this.serviceArray[region]["sqs"]){
                    this.serviceArray[region]["sqs"] = [resource.ResourceARN];
                } else {
                    this.serviceArray[region]["sqs"].push(resource.ResourceARN);
                }
            } else if ( resource.ResourceARN.includes('rds') && resource.ResourceARN.includes(':cluster:') && resource.Engine){
                if (!this.serviceArray[region]["aurora"]){
                    this.serviceArray[region]["aurora"] = [resource];
                } else {
                    this.serviceArray[region]["aurora"].push(resource);
                }
            } else if ( resource.ResourceARN.includes('elasticloadbalancing') && (resource.ResourceARN.includes('/net/') || resource.ResourceARN.includes('/app/'))){
                if (!this.serviceArray[region]["elbv2"]){
                    this.serviceArray[region]["elbv2"] = [resource];
                } else {
                    this.serviceArray[region]["elbv2"].push(resource);
                }
            } else if ( resource.ResourceARN.includes('elasticloadbalancing') && ! resource.ResourceARN.includes('/net/') && ! resource.ResourceARN.includes('/app/')){
                if (!this.serviceArray[region]["elbv1"]){
                    this.serviceArray[region]["elbv1"] = [resource];
                } else {
                    this.serviceArray[region]["elbv1"].push(resource);
                }
            } else if ( resource.ResourceARN.includes('capacity-reservation')){
                if (!this.serviceArray[region]["odcr"]){
                    this.serviceArray[region]["odcr"] = [resource];
                } else {
                    this.serviceArray[region]["odcr"].push(resource);
                }
            }
        }
    }

    private getRandomString(length:number){
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    hasTagKey(data:any[],tagkey:string){
        for ( let item of data){
            if ( item.Key === tagkey ) return true
        }
        return false;
    }

    getWidgets(){
        return this.widgetArray;
    }



}
