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

    alarms_in_alarm_state = sort_by_priority(alarms_in_alarm_state)
    grid_size = 10
    font_size = 12

    number_of_alarms = len(alarms_in_alarm_state)

    if 30 < number_of_alarms <= 45:
        grid_size = 15
        font_size = 10
    elif 45 < number_of_alarms <= 60:
        grid_size = 20
        font_size = 9
    elif number_of_alarms > 60:
        grid_size = 25
        font_size = 8


    body = '''<!DOCTYPE html>
    <html>
    <head>
      <style>
        /* Basic reset */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Container holding the grid */
        .grid-container {
          display: grid;'''
    body += f'  grid-template-columns: repeat({grid_size}, {grid_size}fr);'

    body += '''  grid-gap: 10px; /* Space between grid items */
          padding: 0px;
          margin: 0;
        }

        /* Grid items */
        .grid-item {
          background-color: rgba(255, 255, 255, 0.8); /* Semi-transparent white */
          border: 1px solid rgba(255, 76, 48, 0.8);
          padding: 10px;
          padding-left: 4px;
          padding-right: 4px;
          padding-bottom: 4px;'''
    body += f'     font-size: {font_size}px;'
    body += '''     text-align: center;
          text-overflow: ellipsis;

          /* Needed to make it work */
          overflow: hidden;
          white-space: nowrap;
        }

        .grid-item-prio {
          background-color: rgba(255, 0, 0, 0.2); /* Semi-transparent white */
          border: 2px solid rgba(255, 0, 0, 1);
          padding: 10px;
          padding-left: 4px;
          padding-right: 4px;
          padding-bottom: 4px;'''
    body += f'     font-size: {font_size}px;'
    body += '''     text-align: center;
          text-overflow: ellipsis;

          /* Needed to make it work */
          overflow: hidden;
          white-space: nowrap;
        }

        .grid-item-low {
          background-color: rgba(0, 0, 0, 0.1); /* Semi-transparent white */
          border: 1px solid rgba(0, 0, 0, 0.8);
          padding: 10px;
          padding-left: 4px;
          padding-right: 4px;
          padding-bottom: 4px;'''
    body += f'     font-size: {font_size}px;'
    body += '''     text-align: center;
          text-overflow: ellipsis;

          /* Needed to make it work */
          overflow: hidden;
          white-space: nowrap;
        }

        .btn-primary {
            float: right;
        }

        .card {
            background: #fff;
            border-radius: 2px;
            display: inline-block;
            margin: 1rem;
            position: relative;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            transition: all 0.3s cubic-bezier(.25,.8,.25,1);
        }
        .card:hover {
            box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
        }
        .card-content {
            padding: 16px;
        }
        .card-content h4 {
            margin-top: 0;
            font-size: 1.5em;
            color: #333;
        }
        .card-content div {
            margin-bottom: 8px;
        }
        .modal-grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            grid-gap: 1rem;
        }
      </style>
    </head>
    <body>

    <div class="grid-container">
      <!--<div class="grid-item-prio">Priority:Medium<br />
        </div>-->
    '''

    for alarm in alarms_in_alarm_state:
        aux_html = ''
        card_html = ''

        alarm_name = alarm['alarmKey'].split('#')[1]
        account_id = alarm['alarmKey'].split('#')[0]
        region = alarm['alarmKey'].split('#')[2]

        auxiliary_info = alarm['auxiliaryInfo']
        resource_id = ''
        resource_deleted_mark = ''

        if 'AlternateContact' in auxiliary_info:
            card_html += "<h4>Alternate Contact (OPERATIONS)</h4>"
            if 'Name' in auxiliary_info['AlternateContact']:
                card_html += f'<div>Name: {auxiliary_info["AlternateContact"]["Name"]}</div'
            if 'Title' in auxiliary_info['AlternateContact']:
                card_html += f'<div>Title: {auxiliary_info["AlternateContact"]["Title"]}</div>'
            if 'PhoneNumber' in auxiliary_info['AlternateContact']:
                card_html += f'<div>Phone: {auxiliary_info["AlternateContact"]["PhoneNumber"]}</div>'
            if 'EmailAddress' in auxiliary_info['AlternateContact']:
                card_html += f'<div>Email: <a href="mailto:{auxiliary_info["AlternateContact"]["EmailAddress"]}">{auxiliary_info["AlternateContact"]["EmailAddress"]}</a></div>'
            card_html += '<hr/>'
        if 'Account' in auxiliary_info:
            card_html += "<h4>Account Info</h4>"
            if 'Status' not in auxiliary_info['Account']:
                print(alarm)
            if 'Status' in auxiliary_info['Account']:
                card_html += f'<div>Status: {auxiliary_info["Account"]["Status"]}</div>'
            if 'Email' in auxiliary_info['Account']:
                card_html += f'<div>Email: <a href="mailto:{auxiliary_info["Account"]["Email"]}">{auxiliary_info["Account"]["Email"]}</a></div>'
            if 'Id' in auxiliary_info['Account']:
                card_html += f'<div>Id: {auxiliary_info["Account"]["Id"]}</div><div>Region: {region}</div><hr />'

        card_html += "<h4>Alarm Details</h4>"
        card_html += f'<div>Detail: {alarm["detail"]["alarmName"]}</div>'
        card_html += f'<div>Current State: {alarm["detail"]["state"]["value"]}</div>'
        card_html += f'<div>State Change Timestamp: {alarm["detail"]["state"]["timestamp"]}</div>'
        card_html += f'<div>State Change Reason: {alarm["detail"]["state"]["reason"]}</div>'
        card_html += '</hr>'

        card_html += f'<hr /><h4>Metric Info</h4>'
        match get_alarm_type(alarm):
            case "composite":
                card_html += f'<div>Composite Alarm</div>'
                card_html += f'<div>Alarm Rule: {alarm["detail"]["configuration"]["alarmRule"]}</div>'
            case "expression":
                for metric in alarm["detail"]["configuration"]["metrics"]:
                    if 'expression' in metric:
                        card_html += f'<div>Expression: {metric["expression"]}</div>'
                        card_html += f'<div>Label: {metric["label"]}</div>'
                        alarm_name = metric["label"]
                    if 'metricStat' in metric:
                        card_html += f'<div>Namespace: {metric["metricStat"]["metric"]["namespace"]}</div>'
                        card_html += f'<div>Metric Name: {metric["metricStat"]["metric"]["name"]}</div>'
                        if len(list(metric["metricStat"]["metric"]["dimensions"].keys())) > 0:
                            card_html += f'<div>Metric Dimensions: <br /></div>'
                            for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                                card_html += f'<div>{dimension}: {metric["metricStat"]["metric"]["dimensions"][dimension]}</div>'
            case "standard":
                for metric in alarm["detail"]["configuration"]["metrics"]:
                    card_html += f'<div>Namespace: {metric["metricStat"]["metric"]["namespace"]}</div>'
                    card_html += f'<div>Metric Name: {metric["metricStat"]["metric"]["name"]}</div>'
                    alarm_name = metric["metricStat"]["metric"]["name"]
                    if len(list(metric["metricStat"]["metric"]["dimensions"].keys())) > 0:
                        card_html += f'<div>Metric Dimensions: <br /></div>'
                        for dimension in list(metric["metricStat"]["metric"]["dimensions"].keys()):
                            card_html += f'<div>{dimension}: {metric["metricStat"]["metric"]["dimensions"][dimension]}</div>'
                            resource_id = metric["metricStat"]["metric"]["dimensions"][dimension]
            case _:
                print(f'Unknown alarm type')
        card_html += '<hr />'
        resource_strike_through = ''
        instance_name = ''
        if 'instanceInfo' in alarm:
            if 'Error' not in alarm['instanceInfo']:
                card_html += f'<hr /><h4>Instance info</h4>'
                if 'Tags' in alarm['instanceInfo'] and len(list(alarm['instanceInfo']['Tags'])) > 0:
                    card_html += f'<div><b>Tags:</b></div>'
                    for tag in alarm['instanceInfo']['Tags']:
                        card_html += f'<div>{tag["Key"]}:{tag["Value"]}</div>'
                        if tag['Key'] == 'Name':
                            instance_name = tag['Value']

                card_html += f'<div><b>Instance ID:</b> {alarm["instanceInfo"]["InstanceId"]} </div>'
                card_html += f'<div><b>Instance Type:</b> {alarm["instanceInfo"]["InstanceType"]} </div>'
                card_html += f'<div><b>AMI ID:</b> {alarm["instanceInfo"]["ImageId"]} </div>'
            else:
                card_html += f'<h4>Instance info</h4>'
                card_html += f'<div>RESOURCE DELETED</div>'
                resource_deleted_mark = '<b>*</b>'
                resource_strike_through = 'style="text-decoration:line-through;"'
        card_html += '<hr />'
        aux_html += card_html

        priority_class = 'grid-item'
        if 'priority' in alarm:
            if alarm["priority"] == 1:
                border_width = 4
                priority_name = 'CRITICAL'
                priority_class = 'grid-item-prio'
            if alarm["priority"] == 2:
                border_width = 2
                priority_name = 'Medium'
                priority_class = 'grid-item'
            if alarm["priority"] == 3:
                border_width = 1
                priority_name = 'Low'
                priority_class = 'grid-item-low'

        body += (f'\t\t<div class="{priority_class}">'
          f'{alarm_name}<br /><span {resource_strike_through}>{resource_deleted_mark}{resource_id}</span></br>')
        body += f'<span>{instance_name}</span><br />'
        body += (f'{account_id}<br />'
          f'<a class="btn btn-primary" style="background-color: rgba(255, 0, 0, 0.5); width: 25px; padding: 5px; margin: 0; border: 1px solid black;"><svg fill="#ffffff" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10px" height="10px" viewBox="0 0 416.979 416.979" xml:space="preserve"><g><path d="M356.004,61.156c-81.37-81.47-213.377-81.551-294.848-0.182c-81.47,81.371-81.552,213.379-0.181,294.85c81.369,81.47,213.378,81.551,294.849,0.181C437.293,274.636,437.375,142.626,356.004,61.156z M237.6,340.786c0,3.217-2.607,5.822-5.822,5.822h-46.576c-3.215,0-5.822-2.605-5.822-5.822V167.885c0-3.217,2.607-5.822,5.822-5.822h46.576c3.215,0,5.822,2.604,5.822,5.822V340.786z M208.49,137.901c-18.618,0-33.766-15.146-33.766-33.765c0-18.617,15.147-33.766,33.766-33.766c18.619,0,33.766,15.148,33.766,33.766C242.256,122.755,227.107,137.901,208.49,137.901z"/></g></svg></a><cwdb-action action="html" '
          f'display="popup" event="click">{aux_html}</cwdb-action></div>\n')

    return body
