import boto3
from datetime import datetime
import json

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

def lambda_handler(event, context):
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])
    print(f'Accessing table {config["dynamoTableName"]}')
    query_params = {
        'IndexName': 'SuppressionIndex',
        'KeyConditionExpression': 'suppressed = :suppressed',
        'ExpressionAttributeValues': {
            ':suppressed': 0
        }
    }

    alarms = []

    while True:
        response = table.query(**query_params)
        alarms.extend(response.get('Items', []))

        if 'LastEvaluatedKey' in response:
            query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            break

    html = '<table style="width:100%">'
    html += ('\t<thead><tr>'
             '<th>Alarm State</th>'
             '<th>Priority</th><th>Alarm Name</th>'
             '<th>Alarm updated</th>'
             '<th>Alarm Account</th>'
             '<th>Contact email</th>'
             '<th>Operations contact</th>'
             '<th></th></tr></thead>')

    for alarm in alarms:
        html += '\t<tr>'
        account_id = alarm['alarmKey'].split('#')[0]
        alarm_name = alarm['alarmKey'].split('#')[1]
        auxiliary_info = alarm['auxiliaryInfo']
        aux_html = ""
        color = "black"
        if alarm["detail"]["state"]["value"] == "ALARM":
            color = "red"
        if alarm["detail"]["state"]["value"] == "OK":
            color = "green"
        html += f'\t\t<td style="color:{color}">{alarm["detail"]["state"]["value"]}</td>'
        html += f'<td>'
        if 'priority' in alarm:
            match alarm["priority"]:
                case 1:
                    priority_name = 'CRITICAL'
                case 2:
                    priority_name = 'Medium'
                case 3:
                    priority_name = 'Low'
                case _:
                    priority_name = 'Not set'

            html += priority_name
        html += f'</td>'

        if 'AlternateContact' in auxiliary_info:
            aux_html += "<hr /><h4>Alternate Contact (OPERATIONS)</h4>"
            if 'Name' in auxiliary_info['AlternateContact']:
                aux_html += f'<div>Name: {auxiliary_info["AlternateContact"]["Name"]}<br />'
            if 'Title' in auxiliary_info['AlternateContact']:
                aux_html += f'Title: {auxiliary_info["AlternateContact"]["Title"]}<br />'
            if 'PhoneNumber' in auxiliary_info['AlternateContact']:
                aux_html += f'Phone: {auxiliary_info["AlternateContact"]["PhoneNumber"]}<br />'
            if 'EmailAddress' in auxiliary_info['AlternateContact']:
                aux_html += (f'Email: <a href="mailto:{auxiliary_info["AlternateContact"]["EmailAddress"]}">'
                             f'{auxiliary_info["AlternateContact"]["EmailAddress"]}</a></div>')

        if 'Account' in auxiliary_info:
            aux_html += "<hr /><h4>Account Info</h4>"
            aux_html += f'<div>Id: {auxiliary_info["Account"]["Id"]}</div>'
            if 'Status' in auxiliary_info['Account']:
                aux_html += f'<div>Status: {auxiliary_info["Account"]["Status"]}<br />' \
                   f'Email: <a href="mailto:{auxiliary_info["Account"]["Email"]}">{auxiliary_info["Account"]["Email"]}</a></div>'

        aux_html += "<hr /><h4>Alarm Details</h4>"
        aux_html += f'<div>Detail: {alarm["detail"]["alarmName"]}</div>'
        aux_html += f'<div>State Change Value: {alarm["detail"]["state"]["value"]}</div>'
        aux_html += f'<div>State Change Timestamp: {alarm["detail"]["state"]["timestamp"]}</div>'
        aux_html += f'<div>State Change Reason: {alarm["detail"]["state"]["reason"]}</div>'

        aux_html += f'<hr /><h4>Metric Info</h4>'
        print("Alarm")
        print(alarm)
        html += f'<td>{alarm["detail"]["alarmName"]}<br />'
        if "metrics" in alarm["detail"]["configuration"]:
            for metric in alarm["detail"]["configuration"]["metrics"]:
                if 'expression' in metric:
                    aux_html += f'<div><h4>Expression</h4>'
                    aux_html += f'<b>Expression</b>: {metric["expression"]}'
                    aux_html += f'<b>Label</b>: {metric["label"]}'
                if 'metricStat' in metric:
                    aux_html += f'<div>Namespace: {metric["metricStat"]["metric"]["namespace"]}</div>'
                    aux_html += f'<div>Metric Name: {metric["metricStat"]["metric"]["name"]}</div>'
                    for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                        aux_html += f'<div>{dimension}: {metric["metricStat"]["metric"]["dimensions"][dimension]}</div>'

                aux_html += f'<hr />'
        else:
            print("Composite alarm detected")
            if "alarmRule" in alarm["detail"]["configuration"]:
                aux_html += f'<div>Alarm Rule: {alarm["detail"]["configuration"]["alarmRule"]}</div>'
                aux_html += f'<hr />'
        html += f'</td>'

        timestamp = alarm["detail"]["state"]["timestamp"].replace("+0000", "")
        timestamp = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S.%f").strftime("%m/%d/%Y %H:%M:%S")
        aux_html += (f'<hr /><h4>Alarm Link</h4>'
                     f'<a href="https://eu-west-1.console.aws.amazon.com/cloudwatch/'
                     f'home?region=eu-west-1#alarmsV2:alarm/{alarm["detail"]["alarmName"]}'
                     f'?">https://eu-west-1.console.aws.amazon.com/cloudwatch/'
                     f'home?region=eu-west-1#alarmsV2:alarm/${alarm["detail"]["alarmName"]}?</a>')
        html += f'\t\t<td>{timestamp}</td>'
        html += f'\t\t<td>{account_id}</td><td>{auxiliary_info["Account"]["Email"]}</td>'
        html += f'<td>'
        if 'AlternateContact' in auxiliary_info:
            html += (
                f'<b><a href="mailto:{auxiliary_info["AlternateContact"]["EmailAddress"]}">'
                f'{auxiliary_info["AlternateContact"]["EmailAddress"]}</a></b>'
                f'<br />'
                f'<b><a href="tel:{auxiliary_info["AlternateContact"]["PhoneNumber"]}">'
                f'{auxiliary_info["AlternateContact"]["PhoneNumber"]}</a></b>')
        html += f'</td>'
        html += (f'\t\t<td><a class="btn" style="font-size:0.6rem; '
                 f'font-wight:400;">More</a>'
                 f'<cwdb-action action="html" display="popup" event="click">'
                 f'{aux_html}</cwdb-action></td>\n')
    else:
        html += '<td style="border: 0;">&nbsp;</td>'
        html += '\t</tr>'

    html += '</table>'
    return html
