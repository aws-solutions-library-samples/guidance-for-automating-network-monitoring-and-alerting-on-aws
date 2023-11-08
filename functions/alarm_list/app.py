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
    print(event)
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    table = dynamodb.Table(config['dynamoTableName'])
    print(f'Accessing table {config["dynamoTableName"]}')
    query_params = {
        'IndexName': 'SuppressionIndex',
        'KeyConditionExpression': 'suppressed = :suppressed',
        'ExpressionAttributeValues': {
            ':suppressed': 0
        },
        'ReturnConsumedCapacity': 'TOTAL'
    }

    alarms = []
    consumedRRUs = 0
    while True:
        response = table.query(**query_params)
        alarms.extend(response.get('Items', []))
        if 'ConsumedCapacity' in response:
            consumedRRUs += response['ConsumedCapacity']['CapacityUnits']
        if 'LastEvaluatedKey' in response:
            query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            break

    print(f'TOTAL RRUS USED {consumedRRUs}')
    monthly_executions = 6*60*24*30
    print(f'Cost of the request {consumedRRUs*0.000000283}')
    total_monthly_RRUs = consumedRRUs * monthly_executions
    total_monthly_cost = round(total_monthly_RRUs*(0.283/1000000),2)
    print(f'Estimated Monthly cost {total_monthly_cost}')
    # Assumptions active alarms dashboard uses half of the RRUs (50% alarms are triggering)
    # Ingestion of alarms and updates is 25% of cost
    # Lambda executions are ignored due to relatively low cost impact

    est_monthly_cost = round(total_monthly_cost + (total_monthly_cost*0.75), 2)

    html = '<table style="width:100%;">'
    html += (f'\t<thead><tr>'
             '<th>Alarm State</th>'
             '<th>Priority</th><th>Alarm Name</th>'
             '<th>Alarm updated</th>'
             '<th>Alarm Account</th>'
             '<th>Contact email</th>'
             '<th>Operations contact</th>'
             f'<th><a>Cost of this</a><cwdb-action action="html" event="click" display="popup">Estimated cost of Alarm Dashboard-solution: <b>${est_monthly_cost}/mo</b><br /><br />'
             '<div style="background-color:rgba(10, 10, 10, 0.1);; padding: 10px; font-size: 12px;">'
             'The cost of this dashboard is mainly driven by WRU and RRUs used to store and retrieve records from the DynamoDB table and Lambda execution cost. Primary cost driver will be WRUs and RRUs and Lambda cost will be ignored as it has smaller cost impact. <br /><br />'
             'WRUs are used when an Alarm changes state and the event is forwarded to be stored in the DynamoDB. Currently two Lambda functions will update the Alarm record. This will cost at least 2 WRUs whenever an Alarm changes the state. <br /><br />'
             'RRUs are used when ever user opens the dashboard or refreshes the dashboard. Two Lambda functions fetch the data. One for the Alarms in ALARM state and second fetches all Alarms. No RRUs are used when user doesn’t have the dashboard open. <br /><br />'
             'This estimation assumes user has the dashboard open 24/7 with refresh set to every 10 seconds in order to estimate maximum cost per month. <br /><br />'
             'Since it’s difficult to do real-time calculation of the cost without doubling the cost the estimation uses the most expensive operation (retrieval of the full list of Alarms) as base to calculate the cost.<br /><br />'
             'Then two assumptions are done:<br />'
             'An assumption that retrieval of Alarms in ALARM state will be less than 50% of it. 50% is then used as value. <br /><br />'
             'Finally assumption is that updates of Alarms (using WRUs) will be FAR less than RRUs but to be sure 25% of base is used. <br /><br />'
             'If you have a high number of Alarms that constantly change state, this can drive a higher than estimated cost.<br /><br />'
             'Formula is: <b>actual_RRUs_for_full_list + (actual_RRUs_for_full_list * 0.75)</b><br /><br />'
             f'In this case:<br /><b>6*60*24*30 = monthly_executions = {monthly_executions}</b><br />'
             f'<b>consumedRRUs (by single request) = {consumedRRUs}</b><br />'
             f'<b>total_monthly_RRUs = monthly_executions * consumedRRUs = {monthly_executions} * {consumedRRUs} = {total_monthly_RRUs}</b><br />'
             f'<b>monthly_cost_base = total_monthly_RRUs * ($0.283 per million RRUs (eu-west-1)) = {total_monthly_RRUs} * ($0.283/1 000 000) = {round(total_monthly_RRUs*(0.283/1000000),2)}</b><br />'
             f'<b>estimated_monthly_cost = monthly_cost_base + (monthly_cost_base * 0.75) = {total_monthly_cost} + {round(total_monthly_cost*0.75,2)} ~= {round(total_monthly_cost + round((total_monthly_cost*0.75),2), 2)}</b><br />'
             'Remember to verify the cost using Cost Explorer!'
             '</div>'
             '</cwdb-action></th></tr></thead>')

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
        email = ""
        if "Email" in auxiliary_info["Account"]:
            email = auxiliary_info["Account"]["Email"]
        html += f'\t\t<td>{account_id}</td><td>{email}</td>'
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
