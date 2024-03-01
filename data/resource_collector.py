import json

import boto3
from botocore.config import Config
from tqdm import tqdm


def log(*args, **kwargs):
    tqdm.write(*args, **kwargs)

def get_resources(tag_name, tag_values, session, config):
    """Get resources from resource groups and tagging API.
    Assembles resources in a list containing only ARN and tags
    """
    return  (
        get_resources_from_api(tag_name, tag_values, session, config)
        + autoscaling_retriever(tag_name, tag_values, session, config)
    )

def get_resources_from_api(tag_name, tag_values, session, config):
    resourcetaggingapi = session.client('resourcegroupstaggingapi', config=config)
    return list(
        resourcetaggingapi.get_paginator('get_resources').paginate(
            TagFilters=[{'Key': tag_name, 'Values': tag_values}]
        ).search('ResourceTagMappingList')
    )

def autoscaling_retriever(tag_name, tag_values, session, config):
    """Autoscaling is not supported by resource groups and tagging api
    This is
    :return:
    """
    asg = session.client('autoscaling', config=config)
    resources = list(
        asg.get_paginator('describe_auto_scaling_groups').paginate(
            Filters=[{'Name': 'tag:' + tag_name, 'Values': tag_values}]
        ).search('AutoScalingGroups')
    )
    for resource in resources:
        resource['ResourceARN'] = resource['AutoScalingGroupARN']
    return resources

def cw_custom_namespace_retriever(session, config):
    """Retrieving all custom namespaces
    """
    cw = session.client('cloudwatch', config=config)
    resources = []
    response = cw.list_metrics()
    for record in response['Metrics']:
        if not record['Namespace'].startswith('AWS/') and not record['Namespace'].startswith('CWAgent') and record['Namespace'] not in resources:
            resources.append(record['Namespace'])
            log(resources)

    try:
        while response['NextToken']:
            response = cw.list_metrics(
                NextToken = response['NextToken']
            )
            for record in response['Metrics']:
                if not record['Namespace'].startswith('AWS/') and not record['Namespace'].startswith('CWAgent') and record['Namespace'] not in resources:
                    resources.append(record['Namespace'])
                    log(resources)
    except:
        log(f'Done fetching cloudwatch namespaces')
    return resources




def router(resource, session, config):
    arn = resource['ResourceARN']
    if ':apigateway:' in arn and '/restapis/' in arn and 'stages' not in arn:
        resource = apigw1_decorator(resource, session, config)
    elif ':apigateway:' in arn and '/apis/' in arn and 'stages' not in arn:
        resource = apigw2_decorator(resource, session, config)
    elif ':appsync:' in arn:
        resource = appsync_decorator(resource, session, config)
    elif ':rds:' in arn and ':cluster:' in arn:
        resource = aurora_decorator(resource, session, config)
    elif ':autoscaling:' in arn and ':autoScalingGroup:' in arn:
        resource = autoscaling_decorator(resource, session, config)
    elif ':capacity-reservation/' in arn:
        resource = odcr_decorator(resource, session, config)
    elif ':dynamodb:' in arn and ':table/' in arn:
        resource = dynamodb_decorator(resource, session, config)
    elif ':ec2:' in arn and ':instance/' in arn:
        resource = ec2_decorator(resource, session, config)
    elif 'lambda' in arn and 'function' in arn:
        resource = lambda_decorator(resource, session, config)
    elif 'elasticloadbalancing' in arn and '/net/' not in arn and '/app/' not in arn and ':targetgroup/' not in arn:
        resource = elb1_decorator(resource, session, config)
    elif 'elasticloadbalancing' in arn and ( '/net/' in arn or '/app/' in arn ) and ':targetgroup/' not in arn:
        resource = elb2_decorator(resource, session, config)
    elif ':ecs:' in arn and ':cluster/' in arn:
        resource = ecs_decorator(resource, session, config)
    elif ':natgateway/' in arn and ':ec2:' in arn:
        resource = natgw_decorator(resource, session, config)
    elif ':transit-gateway/' in arn and ':ec2:' in arn:
        resource = tgw_decorator(resource, session, config)
    elif ':sqs:' in arn:
        resource = sqs_decorator(resource, session, config)
    elif 'arn:aws:s3:' in arn:
        resource = s3_decorator(resource, session, config)
    elif ':sns:' in arn:
        resource = sns_decorator(resource, session, config)
    elif ':cloudfront:' in arn and ':distribution/' in arn:
        resource = cloudfront_decorator(resource, session, config)
    elif ':elasticache:' in arn:
        resource = elasticache_decorator(resource, session, config)
    elif ':mediapackage:' in arn and ':channels/' in arn:
        resource = mediapackage_decorator(resource, session, config)
    elif ':medialive:' in arn and ':channel:' in arn:
        resource = medialive_decorator(resource, session, config)
    elif ':elasticfilesystem:' in arn:
        resource = efs_decorator(resource, session, config)
    elif 'arn:aws:elasticbeanstalk:' in arn:
        resource = beanstalk_decorator(resource,session, config)
    return resource


def apigw1_decorator(resource, session, config):
    log(f'This resource is API Gateway 1 {resource["ResourceARN"]}')
    apiid = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    apigw = session.client('apigateway', config=config)
    response = apigw.get_rest_api(
        restApiId=apiid
    )
    response2 = apigw.get_stages(
        restApiId=apiid
    )
    resource['name'] = response['name']
    resource['endpointConfiguration'] = response['endpointConfiguration']['types'][0]
    resource['disableExecuteApiEndpoint'] = response['disableExecuteApiEndpoint']
    resource['stages'] = response2['item']
    return resource

def apigw2_decorator(resource, session, config):
    log(f'This resource is API Gateway 2 {resource["ResourceARN"]}')
    apiid = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/')) - 1]
    apigw = session.client('apigatewayv2', config=config)
    response = apigw.get_api(
        ApiId=apiid
    )
    resource['name'] = response['Name']
    resource['apiid'] = response['ApiId']
    resource['type'] = response['ProtocolType']
    resource['disableExecuteApiEndpoint'] = response['DisableExecuteApiEndpoint']
    resource['endpoint'] = response['ApiEndpoint']
    return resource


def appsync_decorator(resource, session, config):
    log(f'This resource is AppSync {resource["ResourceARN"]}')
    apiid = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/')) - 1]
    appsync = session.client('appsync', config=config)
    response = appsync.get_graphql_api(
        apiId=apiid
    )
    resource['name'] = response['graphqlApi']['name']
    resource['apiId'] = response['graphqlApi']['apiId']
    resource['xrayEnabled'] = response['graphqlApi']['xrayEnabled']
    resource['realtimeUri'] = response['graphqlApi']['uris']['REALTIME']
    resource['graphqlUri'] = response['graphqlApi']['uris']['GRAPHQL']

    return resource


def aurora_decorator(resource, session, config):
    log(f'This resource is Aurora {resource["ResourceARN"]}')
    clusterid = resource['ResourceARN'].split(':')[len(resource['ResourceARN'].split(':')) - 1]
    rds = session.client('rds', config=config)
    try:
        response = rds.describe_db_clusters(
            DBClusterIdentifier=clusterid
        )
        resource['MultiAZ'] = response['DBClusters'][0]['MultiAZ']
        resource['Engine'] = response['DBClusters'][0]['Engine']
        resource['EngineMode'] = response['DBClusters'][0]['EngineMode']
        resource['DBClusterMembers'] = response['DBClusters'][0]['DBClusterMembers']
        resource['Endpoint'] = response['DBClusters'][0]['Endpoint']
        resource['ReaderEndpoint'] = response['DBClusters'][0]['ReaderEndpoint']
        resource['EngineVersion'] = response['DBClusters'][0]['EngineVersion']
        resource['ReadReplicaIdentifiers'] = response['DBClusters'][0]['ReadReplicaIdentifiers']
        resource['DBClusterInstanceClass'] = resource['DBClusters'][0]['DBClusterInstanceClass']
        resource['StorageType'] = response['DBClusters'][0]['StorageType']
        resource['Iops'] = response['DBClusters'][0]['Iops']
        resource['PerformanceInsightsEnabled'] = response['DBClusters'][0]['PerformanceInsightsEnabled']
    except:
        log('Just aurora-resource')

    return resource


def autoscaling_decorator(resource, session, config):
    log(f'This resource is Autoscaling Group {resource["ResourceARN"]}')
    return resource

def beanstalk_decorator(resource, session, config):
    return resource

def cloudfront_decorator(resource, session, config):
    log(f'This resource is CloudFront distribution')
    client = session.client('cloudfront', config=config)
    response = client.get_distribution(
        Id = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    )
    resource['Id'] = response['Distribution']['Id']
    resource['ARN'] = response['Distribution']['ARN']
    resource['DomainName'] = response['Distribution']['DomainName']
    resource['Aliases'] = response['Distribution']['DistributionConfig']['Aliases']
    resource['Origins'] = response['Distribution']['DistributionConfig']['Origins']
    return resource

def mediapackage_decorator(resource, session, config):
    log(f'this resource is Mediapackage channel')
    arn = resource['ResourceARN']
    client = session.client('mediapackage', config=config)
    response = client.list_channels(
        MaxResults=40,
    
    )
    for i in range(len(response['Channels'])):
        if (arn == response['Channels'][i]['Arn']):
            resource['Id'] = response['Channels'][i]['Id']
            resource['ARN'] = response['Channels'][i]['Arn']
            response2 = client.describe_channel(Id = response['Channels'][i]['Id'])
            origin_endpoint = client.list_origin_endpoints(
                ChannelId = response['Channels'][i]['Id']
                )
            resource ['IngestEndpoint'] = response2['HlsIngest']['IngestEndpoints']
            resource['OriginEndpoint'] = origin_endpoint['OriginEndpoints']
    return resource
        
def medialive_decorator(resource, session, config):
    log(f'this resource is Medialive channel')
    arn = resource['ResourceARN']
    client = session.client('medialive', config=config)
    response = client.list_channels(
        MaxResults=40,
    )
    for i in range(len(response['Channels'])):
        if (arn == response['Channels'][i]['Arn']):
            resource['ARN'] = response['Channels'][i]['Arn']
            resource['id'] = response['Channels'][i]['Id']
            response2 = client.describe_channel(
                ChannelId = response['Channels'][i]['Id']
                )
            resource['Pipeline'] = response2['PipelineDetails']
    return resource
    
def odcr_decorator(resource, session, config):
    log(f'This resource is ODCR {resource["ResourceARN"]}')
    return resource


def dynamodb_decorator(resource, session, config):
    log(f'This resource is DynamoDB {resource["ResourceARN"]}')
    tablename = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    ddb = session.client('dynamodb', config=config)
    response = ddb.describe_table(
        TableName=tablename
    )
    table = response['Table']
    type = "provisioned"
    if 'BillingModeSummary' in table:
        type = "ondemand"

    wcu = table['ProvisionedThroughput']['WriteCapacityUnits']
    rcu = table['ProvisionedThroughput']['ReadCapacityUnits']

    resource['type'] = type
    resource['wcu'] = wcu
    resource['rcu'] = rcu
    return resource

def efs_decorator(resource, session, config):
    log(f'This resource is EFS {resource["ResourceARN"]}')
    fsId = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    efs = session.client('efs', config=config)
    response = efs.describe_file_systems(
        FileSystemId=fsId
    )
    
    resource['ThroughputMode'] = response['FileSystems'][0]['ThroughputMode']
    return resource


def ec2_decorator(resource, session, config):
    log(f'This resource is EC2 {resource["ResourceARN"]}')
    instanceid = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    ec2 = session.client('ec2', config=config)

    volumes = []

    response = ec2.describe_volumes(
        Filters=[
        {
            'Name': 'attachment.instance-id',
            'Values': [
                instanceid,
            ]
        },
        ],
        MaxResults=100
    )


    for record in response['Volumes']:
        volumes.append(record)

    try:
        while response['NextToken']:
            response = ec2.describe_volumes(
                Filters=[
                {
                    'Name': 'attachment.instance-id',
                    'Values': [
                        instanceid,
                    ]
                },
                ],
                MaxResults=100,
                NextToken=response['NextToken']
            )
            for record in response['Volumes']:
                volumes.append(record)

    except:
        log(f'Done fetching volumes')

    resource['Volumes'] = volumes

    response = ec2.describe_instances(
        Filters=[
            {
               'Name': 'instance-id',
               'Values': [
                   instanceid
               ]
            }
        ]
    )
    resource['Instance'] = response['Reservations'][0]['Instances'][0]
    instanceType = resource['Instance']['InstanceType']

    if 't2' in instanceType or 't3' in instanceType or 't4' in instanceType:
        response = ec2.describe_instance_credit_specifications(
            InstanceIds=[instanceid]
        )
        resource['CPUCreditSpecs'] = response['InstanceCreditSpecifications'][0]

    cw = session.client('cloudwatch', config=config)
    results = cw.get_paginator('list_metrics')
    for response in results.paginate(
            MetricName='mem_used_percent',
            Namespace='CWAgent',
            Dimensions=[
                {'Name': 'InstanceId', 'Value': instanceid}
            ], ):
        if len(response['Metrics']) > 0:
            log(f'Instance {instanceid} has CWAgent')
            resource['CWAgent'] = 'True'
        else:
            log(f'Instance {instanceid} does not have CWAgent')
            resource['CWAgent'] = 'False'

    return resource

def elasticache_decorator(resource, session, config):
    log(f'This resource is Elasticache {resource["ResourceARN"]}')
    if ':cluster:' in resource['ResourceARN']:
        clusterid = resource['ResourceARN'].split(':')[len(resource['ResourceARN'].split(':'))-1]
        client = session.client('elasticache', config=config)
        response = client.describe_cache_clusters(
            CacheClusterId=clusterid
        )
        resource['ClusterInfo'] = response['CacheClusters'][0]
        if 'redis' in resource['ClusterInfo']['Engine']:
            replication_group = resource['ClusterInfo']['ReplicationGroupId']
            response2 = client.describe_replication_groups(
                                   ReplicationGroupId=replication_group
                               )
            resource['ReplicationGroup'] = response2['ReplicationGroups'][0]
            cn = open(f'../data/{resource["ClusterInfo"]["CacheClusterId"]}_replicationgroup.json', "w")
            cn.write(json.dumps(resource['ReplicationGroup'], indent=4, default=str))
            cn.close()

    return resource


def lambda_decorator(resource, session, config):
    log(f'This resource is Lambda {resource["ResourceARN"]}')
    functionname = resource['ResourceARN'].split(':')[len(resource['ResourceARN'].split(':')) - 1]
    lambdaclient = session.client('lambda', config=config)
    response = lambdaclient.get_function(
        FunctionName=functionname
    )
    resource['Configuration'] = response['Configuration']
    return resource


def elb1_decorator(resource, session, config):
    log(f'This resource is ELBv1 {resource["ResourceARN"]}')
    elbname = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    elb = session.client('elb', config=config)
    response = elb.describe_load_balancers(
       LoadBalancerNames=[
           elbname
        ]
    )
    resource['Extras'] = response['LoadBalancerDescriptions'][0]
    return resource


def elb2_decorator(resource, session, config):
    log(f'This resource is ELBv2 {resource["ResourceARN"]}')
    elb = session.client('elbv2', config=config)
    response = elb.describe_load_balancers(
        LoadBalancerArns=[
            resource['ResourceARN']
        ]
    )
    resource['Extras'] = response['LoadBalancers'][0]
    response = elb.describe_target_groups(
        LoadBalancerArn=resource['ResourceARN']
    )
    resource['TargetGroups'] = response['TargetGroups']
    return resource


def ecs_decorator(resource, session, config):
    log(f'This resource is ECS {resource["ResourceARN"]}')
    ecs = session.client('ecs', config=config)
    response = ecs.describe_clusters(
        clusters=[
            resource['ResourceARN']
        ]
    )
    resource['cluster'] = response['clusters'][0]
    response = ecs.list_services(
        cluster=resource['ResourceARN']
    )

    response = ecs.describe_services(
        cluster=resource['ResourceARN'],
        services=response['serviceArns']
    )
    for service in response['services']:
        del service['events']
    services = response['services']

    for service in services:
        target_groups = []
        instances = []
        if service['launchType'] == 'EC2':
            for lb in service['loadBalancers']:
                target_groups.append(lb['targetGroupArn'])

        elb = session.client('elbv2', config=config)
        for target_group in target_groups:
            response = elb.describe_target_health(
                TargetGroupArn=target_group
            )
            targets = response['TargetHealthDescriptions']

            for target in targets:
                instances.append(target['Target']['Id'])

        service['instances'] = instances
    resource['services'] = services

    return resource


def natgw_decorator(resource, session, config):
    log(f'This resource is NAT-gw {resource["ResourceARN"]}')
    return resource


def rds_decorator(resource, session, config):
    log(f'This resource is RDS {resource["ResourceARN"]}')
    return resource

def s3_decorator(resource, session, config):
    bucket_name = resource['ResourceARN'].split(':')[len(resource['ResourceARN'].split(':'))-1]
    resource['BucketName'] = bucket_name
    log(f'This resource {bucket_name} is S3 bucket')
    s3client = session.client('s3', config=config)
    try:
        encryption_request = s3client.get_bucket_encryption(
            Bucket=bucket_name
        )
        enc_type = 'SSE-S3'
        if encryption_request['ServerSideEncryptionConfiguration']['Rules'][0]['ApplyServerSideEncryptionByDefault']['SSEAlgorithm'] == "aws:kms":
            enc_type = 'SSE-KMS'
        encryption = {}
        encryption['Type'] = enc_type
        encryption['BucketKeyEnabled'] = encryption_request['ServerSideEncryptionConfiguration']['Rules'][0]['BucketKeyEnabled']
        resource['Encryption'] = encryption
    except s3client.exceptions.ClientError:
        resource['Encryption']=False

    response = s3client.get_bucket_location(
        Bucket=bucket_name
    )

    region="us-east-1"
    if response['LocationConstraint']:
        region = response['LocationConstraint']

    resource['Region'] = region
    return resource


def sqs_decorator(resource, session, config):
    log(f'This resource is SQS {resource["ResourceARN"]}')
    queueName = resource['ResourceARN'].split(':')[len(resource['ResourceARN'].split(':'))-1]
    sqs = session.client('sqs', config=config)
    response = sqs.get_queue_url(
        QueueName=queueName
    )
    response = sqs.get_queue_attributes(
        AttributeNames=['All'],
        QueueUrl=response['QueueUrl']
    )
    resource['Attributes'] = response['Attributes']
    return resource

def sns_decorator(resource, session, config):
    log(f'This resource is SNS {resource["ResourceARN"]}')
#     sns = session.client('sns', config=config)
#     response = sns.get_topic_attributes(
#         TopicArn=resource['ResourceARN']
#     )
#
#     debug(response)

    return resource


def tgw_decorator(resource, session, config):
    log(f'This resource is TGW {resource["ResourceARN"]}')
    tgwid = resource['ResourceARN'].split('/')[len(resource['ResourceARN'].split('/'))-1]
    tgw = session.client('ec2', config=config)
    response = tgw.describe_transit_gateway_attachments(
        Filters=[{
            'Name': 'transit-gateway-id',
            'Values': [
                tgwid
            ]
        }],
    )

    resource['attachments'] = response['TransitGatewayAttachments']
    return resource


def debug(resource):
    log(json.dumps(resource, indent=4, default=str))

def get_config(region):
    return Config(
        region_name=region,
        signature_version='s3v4',
        retries={
            'max_attempts': 10,
            'mode': 'standard'
        }
    )

def handler():
    tag_name = 'iem'
    tag_values = ['202202', '202102']
    regions = ['eu-west-1', 'eu-north-1']
    output_file = "resources.json"
    custom_namespace_file = "custom_namespaces.json"
    try:
        f = open("../lib/session.json", "r")
        main_config = json.load(f)
    except:
        log("Could not find session file!!! You should run this from 'data' directory!")
        quit()

    try:
        if main_config['ResourceFile']:
            output_file = main_config['ResourceFile']
    except:
        log('No ResourceFile configured using default')

    try:
        if main_config['TagKey']:
            tag_name = main_config['TagKey']
    except:
        log('No tag key configured')

    try:
        if main_config['TagValues']:
            tag_values = main_config['TagValues']
    except:
        log('No tag values configured')

    try:
        if main_config['Regions']:
            regions = main_config['Regions']
    except:
        log('No regions configured')

    try:
        if main_config['CustomNamespaceFile']:
            custom_namespace_file = main_config['CustomNamespaceFile']
    except:
        log('No custom namespaces configured')

    decorated_resources = []
    region_namespaces = {'RegionNamespaces': []}
    if 'us-east-1' not in regions:
        regions.append('us-east-1')
        log('Added us-east-1 region for global services')

    for region in regions:
        config = get_config(region)
        session = boto3.Session(profile_name=None)
        resources = get_resources(tag_name, tag_values, session, config)
        region_namespace = {'Region': region, 'Namespaces' : cw_custom_namespace_retriever(session, config) }
        region_namespaces['RegionNamespaces'].append(region_namespace)
        for resource in resources:
            decorated_resources.append(router(resource, session, config))
    cn = open(custom_namespace_file, "w")
    cn.write(json.dumps(region_namespaces, indent=4, default=str))
    cn.close()
    n = open(output_file, "w")
    n.write(json.dumps(decorated_resources, indent=4, default=str))
    n.close()

if __name__ == '__main__':
    handler()
