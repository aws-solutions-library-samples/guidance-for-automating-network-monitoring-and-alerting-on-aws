import boto3
import json

ssm_client = boto3.client('ssm')


def get_parameter_from_store(param_name):
    response = ssm_client.get_parameter(
        Name=param_name,
        WithDecryption=True  # Use this if the parameter value is encrypted
    )
    return response['Parameter']['Value']


def put_parameter_to_store(param_name, param_value):
    response = ssm_client.put_parameter(
        Name=param_name,
        Value=param_value,
        Type='String',
        Overwrite=True
    )
    return response


def handle_suppression_request(event, config):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(config['dynamoTableName'])
    update_expression = f'''SET suppressed=:suppressed'''
    expression_attribute_values = {
        ':suppressed': 1
    }

    table.update_item(
        Key={
            'alarmKey': event['suppress']
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_attribute_values,
        ReturnValues="ALL_NEW"
    )

    return f'''<pre>The Alarm "{event['suppress']}" has been suppressed. It won't show up on the widgets!'''


def lambda_handler(event, context):
    print(event)
    print(context)
    message = "Configuration applied:"
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    if 'region' in event:
        config['region_filter'] = event['region']
        message += f" region_filter={event['region']}"

    if 'sort_by_region' in event:
        config['sort_by_region'] = event['sort_by_region']
        message += f" sort_by_region={event['sort_by_region']}"

    if 'account' in event:
        config['account_filter'] = event['account']
        message += f" account_filter={event['account']}"

    if 'sort_by_account' in event:
        config['sort_by_account'] = event['sort_by_account']
        message += f" sort_by_account={event['sort_by_account']}"

    if 'state' in event:
        config['state_filter'] = event['state']
        message += f" state_filter={event['state']}"

    if 'priority' in event:
        config['priority_filter'] = event['priority']
        message += f" priority_filter={event['priority']}"

    if 'suppress' in event:
        return handle_suppression_request(event,config)



    message += f", current config:"
    if 'region_filter' in config:
        message += f" region_filter={config['region_filter']}"
    if 'account_filter' in config:
        message += f" account_filter={config['account_filter']}"
    if 'sort_by_region' in config:
        message += f" sort_by_region={config['sort_by_region']}"
    if 'sort_by_account' in config:
        message += f" sort_by_account={config['sort_by_account']}"
    if 'state_filter' in config:
        message += f" state_filter={config['state_filter']}"
    if 'priority_filter' in config:
        message += f" priority_filter={config['priority_filter']}"

    put_parameter_to_store('CloudWatchAlarmWidgetConfigCDK', json.dumps(config))
    return message
