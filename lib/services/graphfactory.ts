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
import {Construct} from "constructs";
import {ELBv2WidgetSet} from "./servicewidgetsets/elbv2";
import {ELBv1WidgetSet} from "./servicewidgetsets/elbv1";
import {CapacityReservationsWidgetSet} from "./servicewidgetsets/capacityreservations";
import {EcsWidgetSet} from "./servicewidgetsets/ecs";
import {TgwWidgetSet} from "./servicewidgetsets/tgw";
import {NatgwWidgetSet} from "./servicewidgetsets/natgw";
import {SNSWidgetSet} from "./servicewidgetsets/sns";
import {WafV2WidgetSet} from "./servicewidgetsets/wafv2";
import {CloudfrontWidgetSet} from "./servicewidgetsets/cloudfront";
import {LambdaGroupWidgetSet} from "./servicewidgetsets/lambdagroup";
import {SQSGroupWidgetSet} from "./servicewidgetsets/sqsgroup";
import {S3WidgetSet} from "./servicewidgetsets/s3";
import {MediaPackageWidgetSet} from "./servicewidgetsets/mediapackage";
import {MediaLiveWidgetSet} from "./servicewidgetsets/medialive";
import {EFSWidgetSet} from "./servicewidgetsets/efs";
import {SnsAction} from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";

export class GraphFactory extends Construct {
    serviceArray:any=[];
    widgetArray:any=[];
    EC2Dashboard:any = null;
    LambdaDashboard:any = null;
    NetworkDashboard:any = null;
    EdgeDashboard:any = null;
    groupedDashboards = new Map<string,any>();
    groupedLambdaDashboards = new Map<string,any>();

    alarmSet:any = [];
    config:any;
    groupResourcesByTag:boolean = false;

    constructor(scope: Construct, id: string, resources:any[], config:any){
        super(scope,id);
        this.config = config;
        this.sortARNsByService(resources);
        this.generate();
    }


    private generate() {
        let regions = Object.keys(this.serviceArray);
        const config = this.config;

        if (this.config.GroupingTagKey && this.config.GroupingTagKey.length > 0) {
            console.log(`Grouping resources by tag: ${this.config.GroupingTagKey}`);
            this.groupResourcesByTag = true;
        } else {
            console.log(`Not grouping resources by tag`);
        }

        for (let region of regions) {
            console.log('Processing region ' + region);
            this.widgetArray.push(new TextWidget({
                markdown: "# Region: " + region,
                width: 24,
                height: 1
            }))
            let servicekeys = Object.keys(this.serviceArray[region]);
            let resourcecounter = 0;
            for (let servicekey of servicekeys) {
                console.log("Processing " + servicekey);
                switch (servicekey) {
                    case "mediapackage": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Media Package",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            if (resource.Id !== undefined) {
                                let channelid = resource.Id;
                                let mediapackage = new MediaPackageWidgetSet(this, `MediaPackageWidgetSet-${channelid}-${region}`, resource);
                                for (const widgetSet of mediapackage.getWidgetSets()) {
                                    this.widgetArray.push(widgetSet);
                                }
                                this.alarmSet = this.alarmSet.concat(mediapackage.getAlarmSet());
                                
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }
                    case "medialive": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Media Live",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            if (resource.id !== undefined) {
                                let mlchannelid = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1]
                                let medialive = new MediaLiveWidgetSet(this, `MediaLiveWidgetSet-${mlchannelid}-${region}`, resource);
                                for (const widgetSet of medialive.getWidgetSets()) {
                                    this.widgetArray.push(widgetSet);
                            }
                            this.alarmSet = this.alarmSet.concat(medialive.getAlarmSet());
                        }    
                            resourcecounter += 1;
                        }
                        break;
                    }
                    case "appsync": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## AppSync",
                            width: 24,
                            height: 1
                        }))
                        let resourceCount = 0;
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let arn = resource.ResourceARN;
                            let graphqlendpoint = arn.split('/')[arn.split('/').length - 1];
                            let appsync = new AppsyncWidgetSet(this, `AppsyncWidgetSet-${graphqlendpoint}`, resource);
                            if (resourceCount === 0) {
                                this.widgetArray.push(appsync.getRegionalMetrics(region, this));
                                resourceCount++
                            }
                            for (const widget of appsync.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.widgetArray.push(new Spacer({width: 24, height: 2}));
                            this.alarmSet = this.alarmSet.concat(appsync.getAlarmSet());
                        }
                        break;
                    }
                    case "apigatewayv1": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## API Gateway V1 (REST)",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let apiid = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1]
                            let apigw = new ApiGatewayV1WidgetSet(this, `APIGWV1WidgetSet-${apiid}-${region}`, resource);
                            for (const widgetSet of apigw.getWidgetSets()) {
                                this.widgetArray.push(widgetSet);
                            }
                            this.alarmSet = this.alarmSet.concat(apigw.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }
                    case "apigatewayv2": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## API Gateway V2 (Websocket/HTTP)",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let gw;
                            if (resource.type === "WEBSOCKET") {
                                gw = new ApiGatewayV2WebSocketWidgetSet(this, `APIGWV2WebSocketWidgetSet-${resource.apiid}-${region}`, resource);
                            } else {
                                gw = new ApiGatewayV2HttpWidgetSet(this, `APIGWV2HTTPWidgetSet-${resource.apiid}-${region}`, resource);
                            }
                            for (const widgetSet of gw.getWidgetSets()) {
                                this.widgetArray.push(widgetSet)
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "dynamodb": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## DynamoDB",
                            width: 24,
                            height: 1
                        }))
                        this.widgetArray.push(DynamodbWidgetSet.getOverallWidget());
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let tablename = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
                            let table = new DynamodbWidgetSet(this, `DynamoDB-${tablename}-${region}`, resource);
                            for (const widget of table.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(table.getAlarmSet());
                            resourcecounter += 1;
                        }
                        this.widgetArray.push(new Spacer({width: 24, height: 2}));
                        break;
                    }

                    case "elasticfilesystem": {
                        const labelWidget = new TextWidget({
                            markdown: `## EFS volumes`,
                            width: 24,
                            height: 1
                        });

                        this.widgetArray.push(labelWidget);

                        for (const resource of this.serviceArray[region][servicekey]) {
                            const fsName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
                            const efs = new EFSWidgetSet(this, `widgetSet-${fsName}`, resource);
                            for (const widget of efs.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }

                            /*this.alarmSet = this.alarmSet.concat(sns.getAlarmSet());
                            resourcecounter += 1*/
                        }
                        break;
                    }

                    case "ec2instances": {
                        //We create the dashboard only if we actually have EC2s in the workload
                        this.processEC2(region, servicekey);
                        break;
                    }
                    case "lambda": {
                        if (this.config.Compact) {
                            this.processCompactLambda(region, servicekey);
                        } else {
                            this.processLambda(region, servicekey);
                        }
                        break;
                    }

                    case "autoscalinggroup": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Autoscaling groups",
                            width: 24,
                            height: 1
                        }))
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let asgId = resource.split(':')[6];
                            let asg = new ASGWidgetSet(this, `ASGWidgetSet-${asgId}-${region}`, resource);
                            for (const widget of asg.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;

                        }
                        this.widgetArray.push(new Spacer({width: 24, height: 2}));
                        break;
                    }

                    case "sqs": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## SQS Queues",
                            width: 24,
                            height: 1
                        }))
                        if ( this.config?.Compact ){
                            let sqsWidgetSetGroup = new SQSGroupWidgetSet(this,`SQS-WidgetSet-${region}`, this.serviceArray[region][servicekey], this.config);
                            this.widgetArray.push(...sqsWidgetSetGroup.getWidgetSets());
                            this.alarmSet.push(...sqsWidgetSetGroup.getAlarmSet());
                        } else {
                            for (const resource of this.serviceArray[region][servicekey]) {
                                let queueName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
                                let sqs = new SQSWidgetSet(this, `SQSWidgetSet-${queueName}-${region}`, resource);
                                for (const widget of sqs.getWidgetSets()) {
                                    this.widgetArray.push(widget);
                                }
                                resourcecounter += 1;
                            }
                        }

                        break;
                    }

                    case "aurora": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## Aurora",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let auroraName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
                            let aurora = new AuroraWidgetSet(this, `AuroraWidgetSet-${auroraName}-${region}`, resource);
                            for (const widget of aurora.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "elbv2": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## ELB (app/net)",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let elbID = resource.ResourceARN.split('/')[3]
                            let elbv2 = new ELBv2WidgetSet(this, `ELBv2WidgetSet-${elbID}-${region}`, resource);
                            for (const widget of elbv2.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(elbv2.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "elbv1": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## ELB Classic",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]) {
                            const elbName = resource.Extras.LoadBalancerName;
                            let elbv1 = new ELBv1WidgetSet(this, `ELBv1WidgetSet-${elbName}-${region}`, resource);
                            for (const widget of elbv1.getWidgetSets()) {
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
                        const odcrs = new CapacityReservationsWidgetSet(this, `Capacity-res-${region}`, this.serviceArray[region][servicekey]);

                        for (const widget of odcrs.getWidgetSets()) {
                            this.widgetArray.push(widget);
                        }
                        this.alarmSet = this.alarmSet.concat(odcrs.getAlarmSet());
                        resourcecounter += 1;
                        break;
                    }

                    case "ecs": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## ECS Clusters",
                            width: 24,
                            height: 1
                        }));
                        for (const resource of this.serviceArray[region][servicekey]) {
                            let clusterName = resource.cluster.clusterName;
                            const ecsCluster = new EcsWidgetSet(this, `ECSCluster-${clusterName}-${region}`, resource);
                            for (const widget of ecsCluster.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(ecsCluster.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "tgw": {
                        if (!this.NetworkDashboard) {
                            this.NetworkDashboard = new Dashboard(this, config.BaseName + '-Network-Dashboard', {
                                dashboardName: config.BaseName + '-Network-Dashboard'
                            });
                        }
                        const labelWidget = new TextWidget({
                            markdown: "## Transit Gateways",
                            width: 24,
                            height: 1
                        });
                        this.NetworkDashboard.addWidgets(labelWidget)
                        for (const resource of this.serviceArray[region][servicekey]) {
                            const tgwId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
                            const tgw = new TgwWidgetSet(this, `tgw-${tgwId}-${region}`, resource);
                            for (const widget of tgw.getWidgetSets()) {
                                this.NetworkDashboard.addWidgets(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(tgw.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "natgw": {
                        if (!this.NetworkDashboard) {
                            this.NetworkDashboard = new Dashboard(this, config.BaseName + '-Network-Dashboard', {
                                dashboardName: config.BaseName + '-Network-Dashboard'
                            });
                        }
                        const labelWidget = new TextWidget({
                            markdown: "## NAT Gateways",
                            width: 24,
                            height: 1
                        });
                        this.NetworkDashboard.addWidgets(labelWidget)
                        for (const resource of this.serviceArray[region][servicekey]) {
                            const natgwId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
                            const natgw = new NatgwWidgetSet(this, `natgw-${natgwId}-${region}`, resource);
                            for (const widget of natgw.getWidgetSets()) {
                                this.NetworkDashboard.addWidgets(widget);
                            }
                            this.alarmSet = this.alarmSet.concat(natgw.getAlarmSet());
                            resourcecounter += 1;
                        }
                        break;
                    }

                    case "sns": {
                        const labelWidget = new TextWidget({
                            markdown: `## SNS Topics`,
                            width: 24,
                            height: 1
                        });

                        this.widgetArray.push(labelWidget);

                        for (const resource of this.serviceArray[region][servicekey]) {
                            const topicName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
                            const sns = new SNSWidgetSet(this, `widgetSetDUB-${topicName}`, resource);
                            for (const widget of sns.getWidgetSets()) {
                                this.widgetArray.push(widget);
                            }

                            this.alarmSet = this.alarmSet.concat(sns.getAlarmSet());
                            resourcecounter += 1
                        }
                        break;
                    }

                    case "wafv2": {
                        if (!this.EdgeDashboard) {
                            this.EdgeDashboard = new Dashboard(this, `${config.BaseName}-Edge-Dashboard`, {
                                dashboardName: `${config.BaseName}-Edge-Dashboard`
                            });
                        }
                        const labelWidget = new TextWidget({
                            markdown: `## WAF WebACLs`,
                            width: 24,
                            height: 1
                        });

                        this.EdgeDashboard.addWidgets(labelWidget);

                        for (const resource of this.serviceArray[region][servicekey]) {
                            const resourceName = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 2];
                            const webacl = new WafV2WidgetSet(this, `widgetSet-${resourceName}`, resource);
                            for (const widget of webacl.getWidgetSets()) {
                                this.EdgeDashboard.addWidgets(widget);
                            }

                            this.alarmSet = this.alarmSet.concat(webacl.getAlarmSet());
                            resourcecounter += 1
                        }
                        break;
                    }

                    case "cloudfront": {
                        if (!this.EdgeDashboard) {
                            this.EdgeDashboard = new Dashboard(this, `${config.BaseName}-Edge-Dashboard`, {
                                dashboardName: `${config.BaseName}-Edge-Dashboard`
                            });
                        }
                        const labelWidget = new TextWidget({
                            markdown: `## CloudFront`,
                            width: 24,
                            height: 1
                        });

                        this.EdgeDashboard.addWidgets(labelWidget);

                        for (const resource of this.serviceArray[region][servicekey]) {
                            const distId = resource['Id'];
                            const cfws = new CloudfrontWidgetSet(this, `cloudfront-${distId}-${region}`, resource);
                            for (const widget of cfws.getWidgetSets()) {
                                this.EdgeDashboard.addWidgets(widget);
                            }

                            this.alarmSet = this.alarmSet.concat(cfws.getAlarmSet());
                            resourcecounter += 1
                        }
                        break;
                    }

                    case "s3": {
                        this.widgetArray.push(new TextWidget({
                            markdown: "## S3 Buckets",
                            width: 24,
                            height: 1
                        }));
                       for (const resource of this.serviceArray[region][servicekey]){
                            const bucketName = resource.BucketName
                            const s3set = new S3WidgetSet(this,`s3-${bucketName}`, resource);
                            this.widgetArray.push(...s3set.getWidgetSets());
                            this.alarmSet.push(...s3set.getAlarmSet());
                        }
                        break;
                    }

                    default: {
                        console.log("Error: not recognised service");
                        break;
                    }
                }
            }
        }
        if (this.alarmSet.length > 0) {
            const height = 1 + Math.floor(this.alarmSet.length / 4) + (this.alarmSet.length % 4 != 0 ? 1 : 0)
            console.log(`Height of alarms is calculated to ${height}. Length is ${this.alarmSet.length}`)
            if ( config.AlarmTopic ){
                for (const alarm of this.alarmSet) {
                    alarm.addAlarmAction(new SnsAction(sns.Topic.fromTopicArn(this,`ALARMTOPIC-${alarm.alarmName}`,config.AlarmTopic)));
                }
            }

            const alarmStatusWidget = new AlarmStatusWidget({
                title: 'Alarms',
                width: 24,
                height: height,
                alarms: this.alarmSet
            });

            this.widgetArray = [alarmStatusWidget].concat(this.widgetArray);
        }
    }

    /***
     * We are sorting by service for better overview on the dashboard
     * @param resources
     * @private
     */
    private sortARNsByService(resources: any[]) {
        for (let resource of resources) {
            let region = resource.ResourceARN.split(':')[3];
            if ( region === '' ) region = 'global';
            if ( ! this.serviceArray[region]){
                this.serviceArray[region] = [];
            }
            if (resource.ResourceARN.includes(':apigateway:') && resource.ResourceARN.includes('/restapis/') && ! resource.ResourceARN.includes('stages')) {
                if (!this.serviceArray[region]["apigatewayv1"]) {
                    this.serviceArray[region]["apigatewayv1"] = [resource];
                } else {
                    this.serviceArray[region]["apigatewayv1"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':apigateway:') && resource.ResourceARN.includes('/apis/') && ! resource.ResourceARN.includes('stages')) {
                if (!this.serviceArray[region]["apigatewayv2"]) {
                    this.serviceArray[region]["apigatewayv2"] = [resource];
                } else {
                    this.serviceArray[region]["apigatewayv2"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':appsync:')) {
                if (!this.serviceArray[region]["appsync"]) {
                    this.serviceArray[region]["appsync"] = [resource];
                } else {
                    this.serviceArray[region]["appsync"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':mediapackage:')) {
                if (!this.serviceArray[region]["mediapackage"]) {
                    this.serviceArray[region]["mediapackage"] = [resource];
                } else {
                    this.serviceArray[region]["mediapackage"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':medialive:')) {
                if (!this.serviceArray[region]["medialive"]) {
                    this.serviceArray[region]["medialive"] = [resource];
                } else {
                    this.serviceArray[region]["medialive"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':dynamodb:') && resource.ResourceARN.includes(":table/")) {
                if (!this.serviceArray[region]["dynamodb"]) {
                    this.serviceArray[region]["dynamodb"] = [resource];
                } else {
                    this.serviceArray[region]["dynamodb"].push(resource);
                }
            }else if ( resource.ResourceARN.includes(':elasticfilesystem:')){
                if (!this.serviceArray[region]["elasticfilesystem"]){
                    this.serviceArray[region]["elasticfilesystem"] = [resource];
                } else {
                    this.serviceArray[region]["elasticfilesystem"].push(resource);
                }
            }else if (resource.ResourceARN.includes(':ec2:') && resource.ResourceARN.includes(':instance/')) {
                if (!this.serviceArray[region]["ec2instances"]) {
                    this.serviceArray[region]["ec2instances"] = [resource];
                } else {
                    this.serviceArray[region]["ec2instances"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':lambda:') && resource.ResourceARN.includes(':function:')) {
                if (!this.serviceArray[region]["lambda"]) {
                    this.serviceArray[region]["lambda"] = [resource];
                } else {
                    this.serviceArray[region]["lambda"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':autoscaling:') && resource.ResourceARN.includes(':autoScalingGroup:')) {
                if (!this.serviceArray[region]["autoscalinggroup"]){
                    this.serviceArray[region]["autoscalinggroup"] = [resource.ResourceARN];
                } else {
                    this.serviceArray[region]["autoscalinggroup"].push(resource.ResourceARN);
                }
            } else if (resource.ResourceARN.includes(':sqs:')){
                if (!this.serviceArray[region]["sqs"]){
                    this.serviceArray[region]["sqs"] = [resource];
                } else {
                    this.serviceArray[region]["sqs"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':rds:') && resource.ResourceARN.includes(':cluster:') && resource.Engine){
                if (!this.serviceArray[region]["aurora"]){
                    this.serviceArray[region]["aurora"] = [resource];
                } else {
                    this.serviceArray[region]["aurora"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':elasticloadbalancing:') && (resource.ResourceARN.includes('/net/') || resource.ResourceARN.includes('/app/')) && ! resource.ResourceARN.includes(':targetgroup/')){
                if (!this.serviceArray[region]["elbv2"]){
                    this.serviceArray[region]["elbv2"] = [resource];
                } else {
                    this.serviceArray[region]["elbv2"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':elasticloadbalancing:') && ! resource.ResourceARN.includes('/net/') && ! resource.ResourceARN.includes('/app/') && ! resource.ResourceARN.includes(':targetgroup/')){
                if (!this.serviceArray[region]["elbv1"]){
                    this.serviceArray[region]["elbv1"] = [resource];
                } else {
                    this.serviceArray[region]["elbv1"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':capacity-reservation/')){
                if (!this.serviceArray[region]["odcr"]){
                    this.serviceArray[region]["odcr"] = [resource];
                } else {
                    this.serviceArray[region]["odcr"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':ecs:') && resource.ResourceARN.includes(':cluster/')){
                if (!this.serviceArray[region]["ecs"]){
                    this.serviceArray[region]["ecs"] = [resource];
                } else {
                    this.serviceArray[region]["ecs"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':transit-gateway/') && resource.ResourceARN.includes(':ec2:')){
                if (!this.serviceArray[region]["tgw"]){
                    this.serviceArray[region]["tgw"] = [resource];
                } else {
                    this.serviceArray[region]["tgw"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':natgateway/') && resource.ResourceARN.includes(':ec2:')){
                if (!this.serviceArray[region]["natgw"]){
                    this.serviceArray[region]["natgw"] = [resource];
                } else {
                    this.serviceArray[region]["natgw"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':sns:')){
                if (!this.serviceArray[region]["sns"]){
                    this.serviceArray[region]["sns"] = [resource];
                } else {
                    this.serviceArray[region]["sns"].push(resource);
                }
            } else if ( resource.ResourceARN.includes(':wafv2:')){
                if (!this.serviceArray[region]["wafv2"]){
                    this.serviceArray[region]["wafv2"] = [resource];
                } else {
                    this.serviceArray[region]["wafv2"].push(resource);
                }
            } else if (resource.ResourceARN.includes(':cloudfront:') && resource.ResourceARN.includes(':distribution/')){
                if (!this.serviceArray[region]["cloudfront"]){
                    this.serviceArray[region]["cloudfront"] = [resource];
                } else {
                    this.serviceArray[region]["cloudfront"].push(resource);
                }
            } else if (resource.ResourceARN.includes('arn:aws:s3:')){
                if (!this.serviceArray[region]["s3"]){
                    this.serviceArray[region]["s3"] = [resource];
                } else {
                    this.serviceArray[region]["s3"].push(resource);
                }
            }
        }
    }

    private processEC2(region:string, servicekey:any){
        //Push instances to new detail dashboard
        for (const resource of this.serviceArray[region][servicekey]) {
            let instanceId = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
            let instance = new Ec2InstancesWidgetSet(this, `EC2InstancesWidgetSet-${instanceId}-${region}`,resource, this.config);
            if ( this.groupResourcesByTag ){
                let instanceGrouped = false;
                for ( const tag of resource.Tags ){
                    if ( tag.Key === this.config.GroupingTagKey ){
                        //Need to remove spaces from the tag value
                        tag.Value = tag.Value.replace(/\s/g, '');
                        if ( this.groupedDashboards.has(tag.Value) ){
                            console.log(`Found Dashboard for value ${tag.Value}`);
                        } else {
                            console.log(`Creating Dashboard for value ${tag.Value}`);
                            const tagLabelWidget = new TextWidget({
                                markdown: `## EC2 Instances - ${tag.Value} ${region}`,
                                width: 24,
                                height: 1
                            })
                            let dash = new Dashboard(this,this.config.BaseName + '-EC2-Dashboard' + '-' + tag.Value,{
                                dashboardName: this.config.BaseName + '-EC2-Dashboard' + '-' + tag.Value
                            });
                            dash.addWidgets(tagLabelWidget);
                            this.groupedDashboards.set(tag.Value,dash);
                        }
                         //console.log(`adding instance grouped ${resource.Instance.InstanceId}`);
                         for (const widget of instance.getWidgetSets()){
                             this.groupedDashboards.get(tag.Value).addWidgets(widget);
                         }
                         this.alarmSet = this.alarmSet.concat(instance.getAlarmSet());
                         instanceGrouped = true;
                    }
                }
                if ( ! instanceGrouped ){
                    if (!this.EC2Dashboard){
                        this.EC2Dashboard = new Dashboard(this,this.config.BaseName + '-EC2-Dashboard',{
                            dashboardName: this.config.BaseName + '-EC2-Dashboard'
                        });
                        const labelWidget = new TextWidget({
                            markdown: "## EC2 Instances " + region,
                            width: 24,
                            height: 1
                        })
                        this.EC2Dashboard.addWidgets(labelWidget);
                    }
                    //console.log(`adding instance non grouped in grouped config ${resource.Instance.InstanceId}`);
                    for (const widget of instance.getWidgetSets()){
                        this.EC2Dashboard.addWidgets(widget);
                    }
                    this.alarmSet = this.alarmSet.concat(instance.getAlarmSet());
                }
            } else {
                if (!this.EC2Dashboard){
                    this.EC2Dashboard = new Dashboard(this,this.config.BaseName + '-EC2-Dashboard',{
                        dashboardName: this.config.BaseName + '-EC2-Dashboard'
                    });
                    const labelWidget = new TextWidget({
                        markdown: "## EC2 Instances " + region,
                        width: 24,
                        height: 1
                    })
                    this.EC2Dashboard.addWidgets(labelWidget);
                }
                //console.log(`adding instance no config ${resource.Instance.InstanceId}`);
                for (const widget of instance.getWidgetSets()){
                    this.EC2Dashboard.addWidgets(widget);
                }
                this.alarmSet = this.alarmSet.concat(instance.getAlarmSet());

            }
        }

    }


    private processLambda(region:string, servicekey:any){
        for (const resource of this.serviceArray[region][servicekey]) {
            let lambda = new LambdaWidgetSet(this,`Lambda-WS-${resource.Configuration.FunctionName}`,resource);

            if ( this.groupResourcesByTag ){
                let lambdaGrouped = false;

                for ( const tag of resource.Tags ){

                    if ( tag.Key === this.config.GroupingTagKey ){

                        tag.Value = tag.Value.replace(/\s/g, '');

                        if ( this.groupedLambdaDashboards.has(tag.Value)){
                            console.log(`Found Lambda Dashboard for value ${tag.Value}`);
                        } else {
                            console.log(`Creating Lambda Dashboard for value ${tag.Value}`);
                            const tagLabelWidget =  new TextWidget({
                                markdown: `## Lambdas - ${tag.Value} ${region}`,
                                width: 24,
                                height: 1
                            });
                            let dash = new Dashboard(this,this.config.BaseName + '-Lambda-Dashboard' + '-' + tag.Value,{
                                dashboardName: this.config.BaseName + '-Lambda-Dashboard' + '-' + tag.Value
                            });
                            dash.addWidgets(tagLabelWidget);
                            this.groupedLambdaDashboards.set(tag.Value,dash);
                        }

                        for (const widget of lambda.getWidgetSets()){
                            this.groupedLambdaDashboards.get(tag.Value).addWidgets(widget);
                        }

                        this.alarmSet = this.alarmSet.concat(lambda.getAlarmSet());
                        lambdaGrouped = true;
                    }
                }
                if ( ! lambdaGrouped ){
                    if ( ! this.LambdaDashboard ){
                        this.LambdaDashboard = new Dashboard(this, `${this.config.BaseName}-Lambda-Dashboard`,{
                            dashboardName: `${this.config.BaseName}-Lambda-Dashboard`
                        });
                        const labelWidget = new TextWidget({
                            markdown: "## Lambdas " + region,
                            width: 24,
                            height: 1
                        })
                        this.LambdaDashboard.addWidgets(labelWidget);
                    }
                    for (const widget of lambda.getWidgetSets()){
                        this.LambdaDashboard.addWidgets(widget);
                    }
                    this.alarmSet = this.alarmSet.concat(lambda.getAlarmSet());
                }
            } else {
                if ( ! this.LambdaDashboard ){
                    this.LambdaDashboard = new Dashboard(this, `${this.config.BaseName}-Lambda-Dashboard`,{
                        dashboardName: `${this.config.BaseName}-Lambda-Dashboard`
                    });
                    const labelWidget = new TextWidget({
                        markdown: "## Lambdas " + region,
                        width: 24,
                        height: 1
                    })
                    this.LambdaDashboard.addWidgets(labelWidget);
                }

                for (const widget of lambda.getWidgetSets()){
                    this.LambdaDashboard.addWidgets(widget);
                }
                this.alarmSet = this.alarmSet.concat(lambda.getAlarmSet());
            }

        }
    }

    private processCompactLambda(region:string, servicekey:any){
        const resourceGroups = new Map<string, Array<any>>();

        for (const resource of this.serviceArray[region][servicekey]) {
            let groupName = 'default';

            if (this.groupResourcesByTag) {
                for (const tag of resource.Tags) {
                    if (tag.Key === this.config.GroupingTagKey) {
                        groupName = tag.Value;
                        break;
                    }
                }
            }

            if (!resourceGroups.has(groupName)) {
                resourceGroups.set(groupName, []);
            }
            resourceGroups?.get(groupName)?.push(resource);
        }

        //At this point we should have a resourceGroups Map containing a hashmap of groupResourcesByTag values containing array of lambdas to iterate over.
        // From this point we group the lambdas into own dashboards.

        const lambdasPerWidget = Math.min(
            100,
            this.config.CompactMaxResourcesPerWidget
        );

        for ( const  [key, lambdas] of resourceGroups ){
            console.log(`processing key ${key}`);
            let dashboard:any = new Dashboard(this,`${this.config.BaseName}-Lambda-${key}-${region}`,{
                dashboardName: `${this.config.BaseName}-Lambda-${key}-${region}`
            });
            let widgetSet:any = [];
            let alarmSet:any = [];

            if ( lambdas ){
                let lambdasRemaining = 0;
                if ( lambdas.length  && lambdas.length > 0 ){
                    lambdasRemaining = lambdas.length;
                }
                let offset = 0;
                while ( lambdasRemaining > 0 ){
                    let lambdaIncrement = lambdas.splice(0, lambdasPerWidget);
                    let lambdaSet = new LambdaGroupWidgetSet(this,`Lambdas-${key}-${region}-${offset}`,lambdaIncrement,this.config);
                    for ( let widget of lambdaSet.getWidgetSets()){
                        widgetSet.push(widget);
                    }
                    alarmSet = alarmSet.concat(lambdaSet.getAlarmSet());
                    lambdasRemaining -= lambdasPerWidget;
                    offset += 1;
                }
            }

            if ( alarmSet.length > 0 ){
                const height = 1 + Math.floor(alarmSet.length/4) + (alarmSet.length%4!=0?1:0)
                const lambdaAlarmStatusWidget = new AlarmStatusWidget({
                    title: 'Alarms',
                    width: 24,
                    height: height,
                    alarms: alarmSet
                });
                widgetSet = [lambdaAlarmStatusWidget].concat(widgetSet);
            }
            for (const widgetSetElement of widgetSet) {
                dashboard.addWidgets(widgetSetElement);
            }
        }
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
