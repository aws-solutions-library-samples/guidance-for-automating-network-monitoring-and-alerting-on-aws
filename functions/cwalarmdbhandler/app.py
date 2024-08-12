import json
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

# Dodo fix assume role distribution
dynamodb = boto3.resource('dynamodb')
ssm_client = boto3.client('ssm')


def get_parameter_from_store(param_name):
    response = ssm_client.get_parameter(
        Name=param_name,
        WithDecryption=True  # Use this if the parameter value is encrypted
    )
    return response['Parameter']['Value']


def is_expression_alarm(alarm):
    for metric in alarm["detail"]["configuration"]["metrics"]:
        if 'expression' in metric:
            return True

    return False


def get_alarm_type(alarm):
    if "metrics" not in alarm["detail"]["configuration"]:
        return "composite"
    elif is_expression_alarm(alarm):
        return "expression"
    else:
        return "standard"


def get_client(service, event_account_id, region):
    # Get the current AWS account ID
    boto_config = Config(
        region_name=region
    )
    sts_client = boto3.client('sts', config=boto_config)
    current_account_id = sts_client.get_caller_identity()['Account']

    # Use local execution role for monitoring account and assumed role for source accounts
    if current_account_id == event_account_id:
        # Use the default boto3 client for the current account
        print('Not assuming cross account role')
        return boto3.client(service, config=boto_config)
    else:
        # Assume the role in the event account
        print('Assuming cross account role')
        target_role = f'arn:aws:iam::{event_account_id}:role/CrossAccountAlarmAugmentationAssumeRole-{region}'
        assumed_role_object = sts_client.assume_role(
            RoleArn=target_role,
            RoleSessionName="AssumeRoleSession1"
        )

        return boto3.client(
            service,
            aws_access_key_id=assumed_role_object['Credentials']['AccessKeyId'],
            aws_secret_access_key=assumed_role_object['Credentials']['SecretAccessKey'],
            aws_session_token=assumed_role_object['Credentials']['SessionToken'],
            config=boto_config
        )


def get_resource_type(metrics):
    for metric in metrics:
        for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
            match dimension:
                case 'InstanceId':
                    return "ec2_instance"
                case 'TableName':
                    return "ddb_table"
                case _:
                    return "Unknown"


def get_alarm_tags(alarm_arn, account_id, region):
    cw_client = get_client('cloudwatch', account_id, region)
    response = cw_client.list_tags_for_resource(
        ResourceARN=alarm_arn
    )
    return response['Tags']


def get_priority(alarm_tags):
    priority = 2
    for tag in alarm_tags:
        if tag['Key'].lower() == 'priority':
            match tag['Value'].lower():
                case 'high':
                    priority = 1
                case "critical":
                    priority = 1
                case "urgent":
                    priority = 1
                case "medium":
                    priority = 2
                case "standard":
                    priority = 2
                case "normal":
                    priority = 2
                case "low":
                    priority = 3
                case _:
                    priority = 2
            break
    return priority


def get_alternate_contact(account_id, region):
    acct_client = get_client('account', account_id, region)
    try:
        result = acct_client.get_alternate_contact(
            AlternateContactType='OPERATIONS'
        )
        return result['AlternateContact']
    except Exception as e:
        print(e)
        print('ERROR: No alternate contact found')
        return {}


def get_ec2_instance_info(account_id, instance_id, region):
    print(f'Getting info for {instance_id}')
    ec2_client = get_client('ec2', account_id, region)
    try:
        response = ec2_client.describe_instances(
            InstanceIds=[
                instance_id
            ]
        )
        return response['Reservations'][0]['Instances'][0]
    except Exception as e:
        print(e)
        print('ERROR: No instance info found')
        return {}


def get_account_info(account_id, region):

    organizations_client = get_client('organizations', account_id, region)
    try:
        result = organizations_client.describe_account(
            AccountId=account_id
        )
        if 'JoinedTimestamp' in result['Account']:
            del result['Account']['JoinedTimestamp']
        return result['Account']
    except Exception as e:
        print(e)
        print('ERROR: No account info found')
        return {}


def augment_event(event):
    payload = event
    region = event['region']
    payload['AlarmName'] = event['detail']['alarmName']

    account_id = event['account']
    payload['Account'] = account_id
    alarm_arn = event['resources'][0]

    payload['AlarmTags'] = get_alarm_tags(alarm_arn, account_id, region)
    payload['Priority'] = get_priority(payload['AlarmTags'])

    payload['AuxiliaryInfo'] = {}
    payload['AuxiliaryInfo']['AlternateContact'] = get_alternate_contact(account_id, region)

    payload['AuxiliaryInfo']['Account'] = get_account_info(account_id, region)

    if get_alarm_type(event) == "standard":
        if get_resource_type(event['detail']['configuration']['metrics']) == 'ec2_instance':
            instance_id = ''
            for metric in event["detail"]["configuration"]["metrics"]:
                if "metricStat" in metric:
                    for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                        if dimension == 'InstanceId':
                            instance_id = metric["metricStat"]["metric"]["dimensions"][dimension]
                else:
                    print('Ignoring metric')
            try:
                instance_info = get_ec2_instance_info(account_id, instance_id, region)
                if not instance_info:
                    payload['InstanceInfo'] = {'Error': 'Instance not found'}
                else:
                    payload['InstanceInfo'] = instance_info
            except ClientError as error:
                print('Error happened: {}'.format(error))

        else:
            print('Not augmenting resource that is not yet implemented!')

    if payload['AuxiliaryInfo']['Account'] == {}:
        payload['AuxiliaryInfo']['Account']['Id'] = account_id

    return payload


def lambda_handler(event, context):
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])

    event['AuxiliaryInfo'] = {}

    event = augment_event(event)

    event['AuxiliaryInfo']['Suppressed'] = 0

    region = event['region']
    alarm_key = f"{event['account']}#{event['detail']['alarmName']}#{region}"

    state_value = event['detail']['state']['value']
    update_expression = ("SET stateValue = :state_value, "
                         "suppressed = if_not_exists(suppressed, :suppressed), "
                         "detail = :detail, auxiliaryInfo = :auxiliary")
    expression_attribute_values = {
                ':state_value': state_value,
                ':suppressed': 0,
                ':detail': event['detail'],
                ':auxiliary': event['AuxiliaryInfo']
            }

    if 'InstanceInfo' in event['detail']:
        update_expression += ', instanceInfo = :instance_info'
        expression_attribute_values[':instance_info'] = event['detail']['InstanceInfo']

    if 'AlarmTags' in event:
        update_expression += ', alarmTags = :alarm_tags'
        expression_attribute_values[':alarm_tags'] = event['AlarmTags']

    if 'Priority' in event:
        update_expression += ', priority = :priority'
        expression_attribute_values[':priority'] = event['Priority']

    response = table.update_item(
        Key={
            'alarmKey': alarm_key
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_attribute_values,
        ReturnValues="ALL_NEW"
    )

    print(f"DynamoDB Response: {response}")
