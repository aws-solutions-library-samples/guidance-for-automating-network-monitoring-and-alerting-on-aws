# TAG Based CloudWatch Dashboard using CDK
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AWS Provider](https://img.shields.io/badge/provider-AWS-orange?logo=amazon-aws&color=ff9900)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html)

The project is an example how to use AWS Resource Groups Tagging API to retrieve a specific tag
and then based on found resources pull additional information from respective service APIs to generate
a configuration file (JSON) to build a CloudWatch Dashboard with *reasonable* metrics and alarms.

## Features 
### Supported services

* API Gateway v1 (REST)
* API Gateway v2 (HTTP, WebSockets)
* AppSync
* Aurora
* Autoscaling Groups
* On-Demand Capacity Reservations
* CloudFront
* DynamoDB
* EBS (as part of EC2)
* EC2 (support for t* burstable instances, support for CloudWatch Agent)
* ELB v1 (ELB Classic)
* ELB v2 (ALB, NLB)
* ECS (EC2 and Fargate)
* Lambda
* NAT Gateway
* RDS
* SNS
* SQS
* Transit Gateway
* WAFv2

### Configuration features

* Use `GroupingTagKey` parameter in `lib/config.json` to group EC instances and lambdas in separate individual dashboards. The value of the parameter should be a tag key and the instances/lambdas will be grouped by value on individual dashboards.
* Use `CustomEC2TagKeys` parameter array in `lib/config.json` to specify additional tag information that will be shown in the EC2 Instance header on the dashboard to help you better identify the instance. The parameter 
should contain an array of tag keys which will be shown in the header in case that tag is set for the instance.
* Use `Compact` parameter in `lib/config.json` to use compact mode for lambda metrics. This will put multiple lambdas in a single widget. Use `CompactMaxResourcesPerWidget` to specify how many lambdas will be visualized in one widget.

## How it works

1. `data/resource_collector.py` is used to call the Resource Groups Tagging API and to generate the configuration file.
2. CDK (v2) is used to generate CloudFormation template and deploy it

## Prerequisites

### To generate the resource configuration:
* Python 3
* Boto 3 (Python module. `python -m pip install boto3`)

### To generate the dashboard
* NodeJS 14+ (required by CDK v2)
* CDK v2 (Installation: `npm -g install aws-cdk@latest`)

## Getting started
1. Check out the project.
2. Change current directory to project directory.
3. If deploying for the first time, run `cdk bootstrap` to bootstrap the environment (https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
4. Run `npm install` to install dependencies.
5. Edit `lib/config.json` and set TagKey to tag key you want to use and TagValues to an array of values. Set Regions to include the regions that contain resources.
6. Run `cd data; python3 resource_collector.py` to create configuration file `resources.json` in the `data` directory. IMPORTANT NOTICE: `data/getResources.sh`is now deprecated and will not be maintained. Use `data/resource_collector.py` instead.
7. **OPTIONAL:** Edit `BaseName`-property in `lib/config.json` to change the name of your dashboard.
8. Run `cdk synth` from the project root to generate CF template in `cdk.out` or `cdk deploy` to deploy directly to your AWS account.

## Tips

Try setting up a CodeCommit repository where you store your code. Set up a CI/CD pipeline to automatically redeploy your dashboard.
This way, if you want to change/add/remove any metrics for any of the services you change the code, commit it, and it will be automatically deployed.

Try creating an EventBridge rule that will listen to specific tag change and trigger the CodeBuild project to redeploy the dashboard.
This way, if you have an autoscaling group or just tag additional resources the dashboard will deploy automatically. In case you do so, monitor your builds
to avoid rare situations where a lot of tag changes could cause excessive amounts of concurrent or queued builds (for example event bridge rule misconfiguration or
variable loads that causes ASG to scale up and down quickly). This can be done by specifying tag value in the Event Bridge rule or instead of triggering the build 
directly from Event Bridge sending it to a Lambda for more flexible decision-making on whether to trigger a build or not.
