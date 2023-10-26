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


def sort_by_priority(alarms):
    for alarm in alarms:
        if 'priority' not in alarm:
            alarm['priority'] = 2
    return sorted(alarms, key=lambda x: x['priority'])


def lambda_handler(event, context):
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])
    #print(f'Compact value is {compact}')
    query_params = {
        'IndexName': 'NonSuppressedAlarms',
        'KeyConditionExpression': 'stateValue = :stateVal AND suppressed = :suppressed',
        'ExpressionAttributeValues': {
            ':stateVal': 'ALARM',
            ':suppressed': 0
        }
    }

    alarms_in_alarm_state = []

    while True:
        response = table.query(**query_params)
        alarms_in_alarm_state.extend(response.get('Items', []))

        if 'LastEvaluatedKey' in response:
            query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            break

    width = event['widgetContext']['width']/10
    html = ("<style>td{ border: 1px solid black; "
            "border-radius: 5px; height: 100px; "
            "color: white; "
            "padding: 10px; "
            "font-family: Amazon Ember,Helvetica Neue,Roboto,Arial,sans-serif; "
            "font-size: 0.8rem; "
            "font-weight: 400;} "
            ".alarm{ background-color: #ffffff; "
            "border-color: red; "
            "color: black } "
            ".OK{ background-color: #6eeb8f; "
            "color: black; }</style>")
    html += "<table>"
    color = "#44ff11"

    rows = len(alarms_in_alarm_state) // 10 + (1 if len(alarms_in_alarm_state) % 10 else 0)

    for alarm in sort_by_priority(alarms_in_alarm_state):
        print(alarm)
    alarms_in_alarm_state = sort_by_priority(alarms_in_alarm_state)
    for i in range(rows):
        html += "<tr class=\"cwdb-no-default-styles\">"
        for j in range(10):
            index = i * 10 + j
            if index < len(alarms_in_alarm_state):
                alarm = alarms_in_alarm_state[index]
                alarm_name = alarm['alarmKey'].split('#')[1]
                account_id = alarm['alarmKey'].split('#')[0]
                auxiliary_info = alarm['auxiliaryInfo']
                resource_id = ''
                resource_deleted_mark = ''
                aux_html = ""
                if 'AlternateContact' in auxiliary_info:
                    print("ALTCT")
                    print(auxiliary_info['AlternateContact'])
                    aux_html += "<hr /><h4>Alternate Contact (OPERATIONS)</h4>"
                    if 'Name' in auxiliary_info['AlternateContact']:
                        aux_html += f'<div>Name: {auxiliary_info["AlternateContact"]["Name"]}<br />'
                    if 'Title' in auxiliary_info['AlternateContact']:
                        aux_html += f'Title: {auxiliary_info["AlternateContact"]["Title"]}<br />'
                    if 'PhoneNumber' in auxiliary_info['AlternateContact']:
                        aux_html += f'Phone: {auxiliary_info["AlternateContact"]["PhoneNumber"]}<br />'
                    if 'EmailAddress' in auxiliary_info['AlternateContact']:
                        aux_html += f'Email: <a href="mailto:{auxiliary_info["AlternateContact"]["EmailAddress"]}">{auxiliary_info["AlternateContact"]["EmailAddress"]}</a></div>'

                if 'Account' in auxiliary_info:
                    print("ACCT")
                    print(auxiliary_info['Account'])
                    aux_html += "<hr /><h4>Account Info</h4>"
                    aux_html += f'<div>Id: {auxiliary_info["Account"]["Id"]}</div>'
                    if 'Status' in auxiliary_info['Account']:
                        aux_html += f'<div>Status: {auxiliary_info["Account"]["Status"]}<br />' \
                            f'Email: <a href="mailto:{auxiliary_info["Account"]["Email"]}">{auxiliary_info["Account"]["Email"]}</a></div>'

                aux_html += "<hr /><h4>Alarm Details</h4>"
                aux_html += f'<div>Detail: {alarm["detail"]["alarmName"]}</div>'
                aux_html += f'<div>State Change Reason: {alarm["detail"]["state"]["value"]}</div>'
                aux_html += f'<div>State Change Timestamp: {alarm["detail"]["state"]["timestamp"]}</div>'
                aux_html += f'<div>State Change Reason: {alarm["detail"]["state"]["reason"]}</div>'
                aux_html += f'<hr /><h4>Metric Info</h4>'

                match get_alarm_type(alarm):
                    case "composite":
                        aux_html += f'<div>Composite Alarm</div>'
                        aux_html += f'<div>Alarm Rule: {alarm["detail"]["configuration"]["alarmRule"]}</div>'
                    case "expression":
                        for metric in alarm["detail"]["configuration"]["metrics"]:
                            if 'expression' in metric:
                                aux_html += f'<div>Expression: {metric["expression"]}</div>'
                                aux_html += f'<div>Label: {metric["label"]}</div>'
                                alarm_name = metric["label"]
                            if 'metricStat' in metric:
                                aux_html += f'<div>Namespace: {metric["metricStat"]["metric"]["namespace"]}</div>'
                                aux_html += f'<div>Metric Name: {metric["metricStat"]["metric"]["name"]}</div>'
                                if len(list(metric["metricStat"]["metric"]["dimensions"].keys())) > 0:
                                    aux_html += f'<div>Metric Dimensions: <br /></div>'
                                    for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                                        aux_html += f'<div>{dimension}: {metric["metricStat"]["metric"]["dimensions"][dimension]}</div>'
                    case "standard":
                        for metric in alarm["detail"]["configuration"]["metrics"]:
                            aux_html += f'<div>Namespace: {metric["metricStat"]["metric"]["namespace"]}</div>'
                            aux_html += f'<div>Metric Name: {metric["metricStat"]["metric"]["name"]}</div>'
                            alarm_name = metric["metricStat"]["metric"]["name"]
                            if len(list(metric["metricStat"]["metric"]["dimensions"].keys())) > 0:
                                aux_html += f'<div>Metric Dimensions: <br /></div>'
                                for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                                    aux_html += f'<div>{dimension}: {metric["metricStat"]["metric"]["dimensions"][dimension]}</div>'
                                    resource_id = metric["metricStat"]["metric"]["dimensions"][dimension]
                    case _:
                        print(f'Unknown alarm type')

                if 'instanceInfo' in alarm:
                    if 'Error' not in alarm['instanceInfo']:
                        aux_html += f'<hr /><h4>Instance info</h4>'
                        if 'Tags' in alarm['instanceInfo'] and len(list(alarm['instanceInfo']['Tags'])) > 0:
                            aux_html += f'<div><b>Tags:</b>'
                            for tag in alarm['instanceInfo']['Tags']:
                                aux_html += f'{tag["Key"]}:{tag["Value"]}<br />'
                            aux_html += f'</div>'
                        aux_html += f'<hr />'
                        aux_html += f'<b>Instance ID:</b> {alarm["instanceInfo"]["InstanceId"]} <br />'
                        aux_html += f'<b>Instance Type:</b> {alarm["instanceInfo"]["InstanceType"]} <br />'
                        aux_html += f'<b>AMI ID:</b> {alarm["instanceInfo"]["ImageId"]} <br />'
                    else:
                        aux_html += f'<hr /><h4>Instance info</h4>'
                        aux_html += f'RESOURCE DELETED'
                        resource_deleted_mark = '<b>*</b>'

                priority = ''
                priority_name = 'Not set'
                border_width = 1
                if 'alarmTags' in alarm:
                    for tag in alarm['alarmTags']:
                        if tag['Key'] == 'priority':
                            priority = f'P:{tag["Value"]}<br />'
                            if 'HIGH' in tag['Value'] or 'CRITICAL' in tag['Value']:
                                border_width = 4
                            if 'MEDIUM' in tag['Value']:
                                border_width = 2

                if 'priority' in alarm:
                    if alarm["priority"] == 1:
                        border_width = 4
                        priority_name = 'CRITICAL'
                    if alarm["priority"] == 2:
                        border_width = 2
                        priority_name = 'Medium'
                    if alarm["priority"] == 3:
                        border_width = 1
                        priority_name = 'Low'

                border = ''
                if priority != "":
                    border = f' style="border-width: {border_width}px"'
                html += (f'\t\t<td class="alarm" width="{width}px"{border}>Priority:{priority_name}<br />'
                         f'{alarm_name} {resource_id}{resource_deleted_mark}</br>{account_id}<br /><br />'
                         f'<a class="btn btn-primary">More info</a><cwdb-action action="html" '
                         f'display="popup" event="click">{aux_html}</cwdb-action></td>\n')

            else:
                html += '<td style="border: 0;">&nbsp;</td>'
        html += "</tr>"

    html += "</table>"
    return html
