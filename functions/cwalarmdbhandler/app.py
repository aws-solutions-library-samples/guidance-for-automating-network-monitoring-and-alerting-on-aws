import json
import boto3
from datetime import datetime
print('Loading function')

dynamodb = boto3.resource('dynamodb')
acct = boto3.client('account')
org = boto3.client('organizations')
ssm_client = boto3.client('ssm')

def get_parameter_from_store(param_name):
    response = ssm_client.get_parameter(
        Name=param_name,
        WithDecryption=True  # Use this if the parameter value is encrypted
    )
    return response['Parameter']['Value']

def lambda_handler(event, context):
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])
    print("firstprint")
    print(json.dumps(event, indent=2))
    print(2)
    print(event['account'])

    event['AuxiliaryInfo'] = {}
    try:
        result = acct.get_alternate_contact(
            AccountId=event['account'],
            AlternateContactType='OPERATIONS'
        )
        print(3)
        print(result['AlternateContact'])
        event['AuxiliaryInfo']['AlternateContact'] = result['AlternateContact']
    except:
        print(f'No Operations contact found for account id {event["account"]}')

    try:
        res = org.describe_account(
            AccountId=event['account']
        )
        event['AuxiliaryInfo']['Account'] = res['Account']
        event['AuxiliaryInfo']['Account']['JoinedTimestamp'] = event['AuxiliaryInfo']['Account']['JoinedTimestamp'].strftime("%Y-%m-%dZ%H:%M:%S.%f%Z")
    except:
        print(f'Unable to exectute account-lookup')
        event['AuxiliaryInfo']['Account'] = event['account']
    print(4)


    event['AuxiliaryInfo']['Suppressed'] = 0
    print(5)
    print(json.dumps(event, default=str))

    #alarm_name = event['detail']['alarmName']
    #account_id = event['account']
    alarm_key = f"{event['account']}#{event['detail']['alarmName']}"
    state_value = event['detail']['state']['value']
    timestamp = datetime.strptime(event['time'], '%Y-%m-%dT%H:%M:%SZ').strftime('%Y%m%d%H%M%S')
    suppressed = event['AuxiliaryInfo']['Suppressed']

    #event['AuxiliaryInfo']['Account']['JoinedTimestamp'] = event['AuxiliaryInfo']['Account']['JoinedTimestamp'].replace(" ","T")
    response = table.update_item(
        Key={
            'alarmKey': alarm_key
        },
        UpdateExpression="SET stateValue = :state_value, suppressed = if_not_exists(suppressed, :suppressed), detail = :detail, auxiliaryInfo = :auxiliary",
        ExpressionAttributeValues={
            ':state_value': state_value,
            ':suppressed': 0,
            ':detail': event['detail'],
            ':auxiliary': event['AuxiliaryInfo']
        },
        ReturnValues="ALL_NEW"
    )

    print(f"DynamoDB Response: {response}")
