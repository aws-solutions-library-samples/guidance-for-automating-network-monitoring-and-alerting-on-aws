import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Duration, RemovalPolicy, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {EventBus, EventBusPolicy, Rule} from "aws-cdk-lib/aws-events";
import {Effect, PolicyStatement, Role, ServicePrincipal, StarPrincipal} from "aws-cdk-lib/aws-iam";
import {AttributeType, BillingMode, ProjectionType, Table} from "aws-cdk-lib/aws-dynamodb";
import {Architecture, Code, Function, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {LambdaFunction} from 'aws-cdk-lib/aws-events-targets';
import {StringParameter} from "aws-cdk-lib/aws-ssm";
import {CustomWidget, Dashboard} from "aws-cdk-lib/aws-cloudwatch";
import {NagSuppressions} from "cdk-nag";


const config = require("../lib/config.json");

export class AlarmDashboardStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        console.log(config['AlarmDashboard']['organizationId']);
        let parameterConfig:any = {};

        // Create the custom EventBus
        const cloudwatchEventBus = new EventBus(this,'CloudWatchEventBus', {
            eventBusName: 'CWAlarmEventBusCDK'
        });

        // Create the resource policy
        const busResourcePolicy = new PolicyStatement({
            sid: 'AllowPutFromAllOrg',
            effect: Effect.ALLOW,
            principals: [new StarPrincipal()],
            actions: [
                'events:PutEvents'
            ],
            resources: [
                cloudwatchEventBus.eventBusArn
            ],
            conditions: {
                StringEquals: {
                    'aws:PrincipalOrgId': config['AlarmDashboard']['organizationId']
                }
            }
        });

        // Attach the policy to the custom EventBus
        new EventBusPolicy(this,'CloudWatchEventBusPolicy',{
            eventBus: cloudwatchEventBus,
            statementId: 'AllowPutFromAllOrg',
            statement: busResourcePolicy.toStatementJson(),
        });

        // Create DynamoDB table for alarms
        const dynamoTable = new Table(this, 'CloudWatchAlarmDynamoDBTable', {
            tableName: 'AlarmStateChangeTableCDK',
            partitionKey: { name: 'alarmKey', type: AttributeType.STRING },
            removalPolicy: RemovalPolicy.DESTROY,
            billingMode: BillingMode.PAY_PER_REQUEST
        });

        parameterConfig['dynamoTableARN'] = dynamoTable.tableArn;
        parameterConfig['dynamoTableName'] = dynamoTable.tableName;
        parameterConfig['eventBusARN'] = cloudwatchEventBus.eventBusArn;

        Tags.of(dynamoTable).add('auto-delete','never');

        // DynamoDB Table GSIs
        dynamoTable.addGlobalSecondaryIndex({
            indexName: 'AlarmKeyIndex',
            partitionKey: { name: 'alarmKey', type: AttributeType.STRING },
            projectionType: ProjectionType.ALL
        });

        dynamoTable.addGlobalSecondaryIndex({
            indexName: 'StateValueIndex',
            partitionKey: { name: 'stateValue', type: AttributeType.STRING},
            projectionType: ProjectionType.ALL
        });

        dynamoTable.addGlobalSecondaryIndex({
            indexName: 'SuppressionIndex',
            partitionKey: { name: 'suppressed', type: AttributeType.NUMBER},
            projectionType: ProjectionType.ALL
        });

        dynamoTable.addGlobalSecondaryIndex({
            indexName: 'NonSuppressedAlarms',
            partitionKey: { name: 'stateValue', type: AttributeType.STRING},
            sortKey: { name: 'suppressed', type: AttributeType.NUMBER},
            projectionType: ProjectionType.ALL
        });
        // END DynamoDB


        //Lambda function for handling the events
        const ddbHandlerLambdaRole = new Role(this, 'CloudWatchAlarmDynamoDBHandlerExecutionRole',{
            description: 'CloudWatchAlarmDynamoDB Handler Role',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            roleName:'CloudWatchAlarmDynamoDBHandlerExecutionRole'
        });

        const ddbHandlerLambdaFunction = new Function(this, 'CloudWatchAlarmDynamoDBHandlerFunction', {
            runtime: Runtime.PYTHON_3_11,
            handler: 'app.lambda_handler',
            code: Code.fromAsset('functions/cwalarmdbhandler/'),
            functionName: 'CloudWatchAlarmDynamoDBHandlerCDK',
            timeout: Duration.seconds(60),
            memorySize: 256,
            tracing: Tracing.ACTIVE,
            role: ddbHandlerLambdaRole
        });

        //Adding policy to the lambda execution role
        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources: ["*"]
            })
        );

        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'dynamodb:PutItem',
                    'dynamodb:GetItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:GetRecords',
                ],
                resources: [dynamoTable.tableArn],
            })
        );

        //Adding policy to the lambda execution role
        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'organizations:DescribeAccount',
                    'organizations:ListAccounts',
                    'account:GetAlternateContact',
                    'account:GetContactInformation',
                    'account:ListRegions',
                ],
                resources: ['*'],
            })
        );

        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'sts:AssumeRole'
                ],
                resources:['arn:aws:iam::*:role/CrossAccountAlarmAugmentationAssumeRole-*']
            })
        );

        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ec2:DescribeInstances'
                ],
                resources:['*']
            })
        );

        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'cloudwatch:ListTagsForResource'
                ],
                resources: ['*']
            })
        );

        // EventBus rule as Lambda function trigger (one on the custom eventbus and one on the default eventbus)
        new Rule(this, 'DDBHandlerTrigger', {
            eventBus: cloudwatchEventBus,
            eventPattern: {
                source: ['aws.cloudwatch'],
                detailType: ['CloudWatch Alarm State Change'],
            },
            targets: [new LambdaFunction(ddbHandlerLambdaFunction)],
        });

        new Rule(this, 'LocalDDBHandlerTrigger', {
            eventPattern: {
                source: ['aws.cloudwatch'],
                detailType: ['CloudWatch Alarm State Change'],
            },
            targets: [new LambdaFunction(ddbHandlerLambdaFunction)],
        });



        // Dashboard infrastructure

        parameterConfig['compact'] = 0
        const configParameter = new StringParameter(this, 'ConfigParameter', {
            stringValue: JSON.stringify(parameterConfig),
            parameterName: 'CloudWatchAlarmWidgetConfigCDK',
            description: 'Config for CloudWatch Alarm Widgets',
        });


        ddbHandlerLambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'ssm:GetParameter'
                ],
                resources: [configParameter.parameterArn]
            })
        );

        const alarmCWCustomFunctionRole = new Role(this, 'alarmCWCustomFunctionExecutionRole',{
            description: 'alarmCWCustomFunction Handler Role',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            roleName:'alarmCWCustomFunctionExecutionRole'
        });

        const alarmCWCustomFunction = new Function(this, 'AlarmCWCustomFunction', {
            code: Code.fromAsset('functions/alarm_view'),
            handler: 'app.lambda_handler',
            runtime: Runtime.PYTHON_3_11,
            architecture: Architecture.X86_64,
            role: alarmCWCustomFunctionRole
        });

        alarmCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources: ["*"]
            })
        );

        alarmCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['ssm:GetParameter'],
                resources: [configParameter.parameterArn],
            })
        );

        alarmCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "dynamodb:GetItem",
                    "dynamodb:Scan",
                    "dynamodb:Query",
                    "dynamodb:BatchGetItem",
                    "dynamodb:DescribeTable",
                    "dynamodb:ConditionCheckItem"
                ],
                resources: [dynamoTable.tableArn,
                    `${dynamoTable.tableArn}/index/AlarmKeyIndex`,
                    `${dynamoTable.tableArn}/index/StateValueIndex`,
                    `${dynamoTable.tableArn}/index/SuppressionIndex`,
                    `${dynamoTable.tableArn}/index/NonSuppressedAlarms`
                ],
            })
        );

        const alarmListCWCustomFunctionRole = new Role(this, 'alarmListCWCustomFunctionRole',{
            description: 'alarmListCWCustomFunction Handler Role',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            roleName:'alarmCListWCustomFunctionExecutionRole'
        });

        const alarmListCWCustomFunction = new Function(this, 'AlarmListCWCustomFunction', {
            code: Code.fromAsset('functions/alarm_list'),
            handler: 'app.lambda_handler',
            runtime: Runtime.PYTHON_3_11,
            architecture: Architecture.X86_64,
            memorySize: 165,
            role: alarmListCWCustomFunctionRole
        });

        alarmListCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources: ["*"]
            })
        );

        alarmListCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "dynamodb:GetItem",
                    "dynamodb:Scan",
                    "dynamodb:Query",
                    "dynamodb:BatchGetItem",
                    "dynamodb:DescribeTable",
                    "dynamodb:ConditionCheckItem"
                ],
                resources: [dynamoTable.tableArn,
                    `${dynamoTable.tableArn}/index/AlarmKeyIndex`,
                    `${dynamoTable.tableArn}/index/StateValueIndex`,
                    `${dynamoTable.tableArn}/index/SuppressionIndex`,
                    `${dynamoTable.tableArn}/index/NonSuppressedAlarms`
                ],
            })
        );

        alarmListCWCustomFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['ssm:GetParameter'],
                resources: [configParameter.parameterArn],
            })
        );



        // CloudWatch Dashboard
        new Dashboard(this, 'AlarmDashboardCDK', {
            dashboardName: 'AlarmDashboardCDK',
            widgets: [
                [new CustomWidget({
                    functionArn: alarmCWCustomFunction.functionArn,
                    title: 'Alarms',
                    height: 10,
                    width: 24,
                    updateOnRefresh: true,
                    updateOnResize: true,
                    updateOnTimeRangeChange: false
                })],
                [new CustomWidget({
                    functionArn: alarmListCWCustomFunction.functionArn,
                    title: "Alarm List",
                    height: 26,
                    width: 24,
                    updateOnRefresh: true,
                    updateOnResize: true,
                    updateOnTimeRangeChange: false
                })]
            ],
        });

        //cdk-nag suppression rules
        NagSuppressions.addResourceSuppressions(ddbHandlerLambdaRole,[
            {
                id: 'AwsSolutions-IAM5',
                reason:'Need CloudWatchAlarmDynamoDBHandlerExecutionRole role to write to arbitrary log groups',
            }
        ], true);

        NagSuppressions.addResourceSuppressions(alarmCWCustomFunctionRole,[
            {
                id: 'AwsSolutions-IAM5',
                reason:'Need alarmCWCustomFunctionExecutionRole to write to arbitrary log groups'
            }
        ], true);

        NagSuppressions.addResourceSuppressions(alarmListCWCustomFunctionRole,[
            {
                id: 'AwsSolutions-IAM5',
                reason:'Need alarmCWCustomFunctionExecutionRole to write to arbitrary log groups'
            }
        ], true);


        NagSuppressions.addResourceSuppressions(dynamoTable,[
            {
                id: 'AwsSolutions-DDB3',
                reason: "Alarm data doesn't require PITR"
            }
        ], true);





        new CfnOutput(this, 'CustomEventBusArn', {
            value: cloudwatchEventBus.eventBusArn
        }).value;

        new CfnOutput(this, 'CustomDynamoDBFunctionRoleArn',{
            value: ddbHandlerLambdaRole.roleArn
        }).value;
    }
}
