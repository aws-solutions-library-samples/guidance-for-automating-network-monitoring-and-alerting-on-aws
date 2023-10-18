import boto3
import json

dynamodb = boto3.resource('dynamodb')
ssm_client = boto3.client('ssm')

def get_parameter_from_store(param_name):
    response = ssm_client.get_parameter(
        Name=param_name,
        WithDecryption=True  # Use this if the parameter value is encrypted
    )
    return response['Parameter']['Value']

def lambda_handler(event, context):
    print(event)
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])
    alarm_key = f"{event['detail']['Account']}#{event['detail']['AlarmName']}"
    update_expression = "SET "
    expression_attribute_values = {}
    if 'InstanceInfo' in event['detail']:
        update_expression += 'instanceInfo = :instance_info'
        expression_attribute_values[':instance_info'] = event['detail']['InstanceInfo']

    if 'AlarmTags' in event['detail']:
        if ':instance_info' in expression_attribute_values:
            update_expression += ', '
        update_expression += 'alarmTags = :alarm_tags'
        expression_attribute_values[':alarm_tags'] = event['detail']['AlarmTags']

    if 'Priority' in event['detail']:
        if ':alarm_tags' or ':instance_info' in expression_attribute_values:
            update_expression += ', '
        update_expression += 'priority = :priority'
        expression_attribute_values[':priority'] = event['detail']['Priority']

    response = table.update_item(
        Key={
            'alarmKey': alarm_key
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_attribute_values,
        ReturnValues="ALL_NEW"
    )

    print(response)




