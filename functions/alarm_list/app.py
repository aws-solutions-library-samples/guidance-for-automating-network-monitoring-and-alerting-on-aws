import boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime
import math
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


def sort_by_property(alarms, prop):
    return sorted(alarms, key=lambda x: x[prop])


def filter_by_property(alarms, prop, value):
    if prop == 'region':
        return [alarm for alarm in alarms if alarm['alarmKey'].split('#')[2] == value]
    if prop == 'account':
        return [alarm for alarm in alarms if alarm['alarmKey'].split('#')[0] == value]
    if prop == 'state':
        return [alarm for alarm in alarms if alarm['detail']['state']['value'] == value]
    if prop == 'priority':
        return [alarm for alarm in alarms if int(alarm['priority']) == int(value)]
    return alarms


def get_filter_icon(color_code):
    return f'''<?xml version="1.0" encoding="iso-8859-1"?>
            <svg fill="#{color_code}" height="12px" width="12px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                 viewBox="0 0 300.906 300.906" xml:space="preserve">
            <g>
                <g>
                    <path d="M288.953,0h-277c-5.522,0-10,4.478-10,10v49.531c0,5.522,4.478,10,10,10h12.372l91.378,107.397v113.978
                        c0,3.688,2.03,7.076,5.281,8.816c1.479,0.792,3.101,1.184,4.718,1.184c1.94,0,3.875-0.564,5.548-1.68l49.5-33
                        c2.782-1.854,4.453-4.977,4.453-8.32v-80.978l91.378-107.397h12.372c5.522,0,10-4.478,10-10V10C298.953,4.478,294.476,0,288.953,0
                        z M167.587,166.77c-1.539,1.809-2.384,4.105-2.384,6.48v79.305l-29.5,19.666V173.25c0-2.375-0.845-4.672-2.384-6.48L50.585,69.531
                        h199.736L167.587,166.77z M278.953,49.531h-257V20h257V49.531z"/>
                </g>
            </g>
            </svg>'''


def get_suppress_icon():
    return f'''<svg fill="#9a9898" height="12px" width="12px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 27.965 27.965" xml:space="preserve">
    <g id="SVGRepo_bgCarrier" stroke-width="0">
    </g>
    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
    <g id="SVGRepo_iconCarrier"> <g>
    <g id="c142_x">
    <path d="M13.98,0C6.259,0,0,6.261,0,13.983c0,7.721,6.259,13.982,13.98,13.982c7.725,0,13.985-6.262,13.985-13.982
    C27.965,6.261,21.705,0,13.98,0z
    M19.992,17.769l-2.227,2.224c0,0-3.523-3.78-3.786-3.78c-0.259,0-3.783,3.78-3.783,3.78
    l-2.228-2.224c0,0,3.784-3.472,3.784-3.781c0-0.314-3.784-3.787-3.784-3.787l2.228-2.229c0,0,3.553,3.782,3.783,3.782
    c0.232,0,3.786-3.782,3.786-3.782l2.227,2.229c0,0-3.785,3.523-3.785,3.787C16.207,14.239,19.992,17.769,19.992,17.769z">
    </path>
    </g>
    <g id="Capa_1_104_"> </g> </g> </g></svg>'''


def paginate_items(items, current_page, page_size):
    pages = math.ceil(len(items) / page_size)
    print(f'Got total {len(items)} items')
    print(f'Got total {pages} of pages')
    print(f'This number ({pages*page_size}) should be higher or same than items ')

    # if current_page < 1 or current_page > pages:
    #     raise ValueError("Invalid current page number")

    if current_page < 1:
        current_page = 1

    if current_page > pages:
        current_page = pages

    start_index = (current_page - 1) * page_size
    end_index = start_index + page_size
    page_items = items[start_index:end_index]

    return page_items


def put_parameter_to_store(param_name, param_value):
    response = ssm_client.put_parameter(
        Name=param_name,
        Value=param_value,
        Type='String',
        Overwrite=True
    )
    return response


def get_account_list(alarms):
    unique_accounts = set()
    for alarm in alarms:
        unique_accounts.add(alarm['alarmKey'].split('#')[0])

    return sorted(list(unique_accounts))


def get_region_list(alarms):
    unique_regions = set()
    for alarm in alarms:
        unique_regions.add(alarm['alarmKey'].split('#')[2])

    return list(unique_regions)


def lambda_handler(event, context):
    print(event)
    config = json.loads(get_parameter_from_store('CloudWatchAlarmWidgetConfigCDK'))
    if 'currentAlarmViewPage' in event:
        config['currentAlarmViewPage'] = int(event['currentAlarmViewPage'])
    if 'region' in event:
        config['region_filter'] = event['region']

    if 'sort_by_region' in event:
        config['sort_by_region'] = event['sort_by_region']

    if 'account' in event:
        config['account_filter'] = event['account']

    if 'sort_by_account' in event:
        config['sort_by_account'] = event['sort_by_account']

    if 'state' in event:
        config['state_filter'] = event['state']

    if 'priority' in event:
        config['priority_filter'] = event['priority']

    put_parameter_to_store('CloudWatchAlarmWidgetConfigCDK', json.dumps(config))

    configurator_lambda_function = ""
    try:
        configurator_lambda_function = config['configuratorLambdaFunction']
        print(f'Configurator Lambda function {configurator_lambda_function}')
    except KeyError:
        print('Configurator Lambda function not found')

    table = dynamodb.Table(config['dynamoTableName'])
    print(f'Accessing table {config["dynamoTableName"]}')
    region_filter_icon_color = "000000"
    account_filter_icon_color = "000000"
    priority_filter_icon_color = "000000"
    state_filter_icon_color = "000000"

    filter_expressions = []

    if 'region_filter' in config and config['region_filter'] != "none":
        filter_expressions.append(Attr("alarmKey").contains("#" + config['region_filter']))
        region_filter_icon_color = "ff0000"

    if 'account_filter' in config and config['account_filter'] != "none":
        filter_expressions.append(Attr("alarmKey").begins_with(config['account_filter'] + "#"))
        account_filter_icon_color = "ff0000"

    if 'state_filter' in config and config['state_filter'] != "none":
        filter_expressions.append(Attr("stateValue").eq(config['state_filter']))
        state_filter_icon_color = "ff0000"

    if 'priority_filter' in config and config['priority_filter'] != "none":
        filter_expressions.append(Attr("priority").eq(int(config['priority_filter'])))
        priority_filter_icon_color = "ff0000"

    query_params = {
        'IndexName': 'SuppressionIndex',
        'KeyConditionExpression': 'suppressed = :suppressed',
        'ExpressionAttributeValues': {
            ':suppressed': 0
        },
        'ReturnConsumedCapacity': 'TOTAL'
    }

    if filter_expressions:
        combined_filter_expression = filter_expressions[0]
        for expr in filter_expressions[1:]:
            combined_filter_expression &= expr

        query_params = {
            'IndexName': 'SuppressionIndex',
            'KeyConditionExpression': 'suppressed = :suppressed',
            'ExpressionAttributeValues': {
                ':suppressed': 0
            },
            'FilterExpression': combined_filter_expression,
            'ReturnConsumedCapacity': 'TOTAL'
        }

    alarms = []
    consumedRRUs = 0
    while True:
        response = table.query(**query_params)
        alarms.extend(response.get('Items', []))
        if 'ConsumedCapacity' in response:
            consumedRRUs += int(response['ConsumedCapacity']['CapacityUnits'])
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

    page = 1
    if 'currentAlarmViewPage' in config and not config['currentAlarmViewPage'] == "none":
        page = int(config['currentAlarmViewPage'])

    page_size = 100
    if 'alarmViewListSize' in config and not config['alarmViewListSize'] == "none":
        page_size = int(config['alarmViewListSize'])

    total_filtered_pages = math.ceil(len(alarms) / page_size)

    alarms = paginate_items(alarms, page, page_size)

    html = '''<div style="width:100%;"><p>'''
    for total_filtered_page in range(1,total_filtered_pages+1,1):
        if total_filtered_page == page:
            html += f'''&nbsp;{total_filtered_page}'''
        else:
            html += f'''&nbsp;<a>{total_filtered_page}</a><cwdb-action action="call"
             endpoint="{context.invoked_function_arn}">
             {{ "currentAlarmViewPage": {total_filtered_page} }}
            </cwdb-action>'''
    html += '''</p></div>
    '''
    html += '<table style="width:100%;">'
    html += f'''\t<thead><tr>
             <th>Alarm State <a>{get_filter_icon(state_filter_icon_color)}</a>'''

    if ('state_filter' in config and config['state_filter'] == "none") or 'state_filter' not in config:
        html += f'''<cwdb-action action="html" 
             display="popup" event="click">
             <style>
                .center {{
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  padding: 10px;
                }}
                
                .center a {{
                margin: 10px;
                
                }}
             </style>
             <div class="center">
                
                    <a class="btn btn-primary">OK</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                         endpoint="{context.invoked_function_arn}">
                         {{ "state": "OK" }}
                        </cwdb-action>
                    <a class="btn btn-primary">ALARM</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                         endpoint="{context.invoked_function_arn}">
                         {{ "state": "ALARM" }}
                        </cwdb-action>
                    <a class="btn btn-primary">INSUFFICIENT_DATA</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                         endpoint="{context.invoked_function_arn}">
                         {{ "state": "INSUFFICIENT_DATA" }}
                        </cwdb-action>
            
            </div>
            </cwdb-action>'''
    else:
        html += f'''<cwdb-action action="call" confirmation="This will remove the state filter!"
                 endpoint="{context.invoked_function_arn}">
                 {{ "state": "none" }}
                </cwdb-action>'''
    html += f'''</th>
             <th>Priority <a>{get_filter_icon(priority_filter_icon_color)}</a>'''

    if ('priority_filter' in config and config['priority_filter'] == "none") or 'priority_filter' not in config:
        html += f'''<cwdb-action action="html" 
                     display="popup" event="click">
                     <style>
                        .center {{
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          transform: translate(-50%, -50%);
                          padding: 10px;
                        }}
                        
                        .center a {{
                        margin: 10px;
                        
                        }}
                     </style>
                     <div class="center">
                        
                            <a class="btn btn-primary">CRITICAL</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                                 endpoint="{context.invoked_function_arn}">
                                 {{ "priority": 1 }}
                                </cwdb-action>
                       
                            <a class="btn btn-primary">Medium</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                                 endpoint="{context.invoked_function_arn}">
                                 {{ "priority": 2 }}
                                </cwdb-action>
           
                            <a class="btn btn-primary">Low</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                                 endpoint="{context.invoked_function_arn}">
                                 {{ "priority": 3 }}
                                </cwdb-action>
                
                    </div>
                    </cwdb-action>'''
    else:
        html += f'''<cwdb-action action="call" confirmation="This will remove the priority filter!"
             endpoint="{context.invoked_function_arn}">
             {{ "priority": "none" }}
            </cwdb-action>'''
    html += f'''</th>
            <th>Alarm Name</th>
            <th>Alarm updated</th>
            <th>Alarm Account <a>{get_filter_icon(account_filter_icon_color)}</a>'''
    if ('account_filter' in config and config['account_filter'] == "none") or 'account_filter' not in config:
        html += f'''<cwdb-action action="html" 
                 display="popup" event="click">
                 <style>
                    .center {{
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      padding: 10px;
                    }}
                    
                    .center a {{
                    margin: 10px;
                    
                    }}
                 </style>
                 <div class="center">
                 '''

        for account in get_account_list(alarms):
            html += f'''
                    <a class="btn btn-primary">{account}</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                         endpoint="{context.invoked_function_arn}">
                        {{ "account": "{account}" }}
                    </cwdb-action>
                '''
        html += f'''</div></cwdb-action>'''

    else:
        html += f'''<cwdb-action action="call" confirmation="This will remove the account filter!"
             endpoint="{context.invoked_function_arn}">
             {{ "account": "none" }}
            </cwdb-action></th>'''
    html += f'''<th>Region <a>{get_filter_icon(region_filter_icon_color)}</a>'''

    if ('region_filter' in config and config['region_filter'] == "none") or 'region_filter' not in config:
        html += f'''<cwdb-action action="html" 
                 display="popup" event="click">
                 <style>
                    .center {{
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        padding: 10px;
                    }}
                    
                    .center a {{
                        margin: 10px;
                    }}
                </style>
                <div class="center">
        '''

        for region in get_region_list(alarms):
            html += f'''
                <a class="btn btn-primary">{region}</a><cwdb-action action="call" confirmation="This will remove the state filter!"
                     endpoint="{context.invoked_function_arn}">
                    {{ "region": "{region}" }}
                </cwdb-action>
            '''
        html += f'''</div></cwdb-action>'''

    else:
        html += f'''<cwdb-action action="call" confirmation="This will remove the region filter!"
             endpoint="{context.invoked_function_arn}">
             {{ "region": "none" }}
            </cwdb-action></th>'''

    html += f'''<th>Contact email</th><th>Operations contact</th>
             <th>
                <a>
                    Cost of this
                </a>
                <cwdb-action action="html" event="click" display="popup">Estimated cost of Alarm Dashboard-solution: <b>${est_monthly_cost}/mo</b><br /><br />
                    <div style="background-color:rgba(10, 10, 10, 0.1);; padding: 10px; font-size: 12px;">
                         The cost of this dashboard is mainly driven by WRU and RRUs used to store and retrieve records from the DynamoDB table and Lambda execution cost. Primary cost driver will be WRUs and RRUs and Lambda cost will be ignored as it has smaller cost impact. <br /><br />
                         WRUs are used when an Alarm changes state and the event is forwarded to be stored in the DynamoDB. Currently two Lambda functions will update the Alarm record. This will cost at least 2 WRUs whenever an Alarm changes the state. <br /><br />
                         RRUs are used when ever user opens the dashboard or refreshes the dashboard. Two Lambda functions fetch the data. One for the Alarms in ALARM state and second fetches all Alarms. No RRUs are used when user doesn’t have the dashboard open. <br /><br />
                         This estimation assumes user has the dashboard open 24/7 with refresh set to every 10 seconds in order to estimate maximum cost per month. <br /><br />
                         Since it’s difficult to do real-time calculation of the cost without doubling the cost the estimation uses the most expensive operation (retrieval of the full list of Alarms) as base to calculate the cost.<br /><br />
                         Then two assumptions are done:<br />
                         An assumption that retrieval of Alarms in ALARM state will be less than 50% of it. 50% is then used as value. <br /><br />
                         Finally assumption is that updates of Alarms (using WRUs) will be FAR less than RRUs but to be sure 25% of base is used. <br /><br />
                         If you have a high number of Alarms that constantly change state, this can drive a higher than estimated cost.<br /><br />
                         Formula is: <b>actual_RRUs_for_full_list + (actual_RRUs_for_full_list * 0.75)</b><br /><br />
                         In this case:<br /><b>6*60*24*30 = monthly_executions = {monthly_executions}</b><br />
                         <b>consumedRRUs (by single request) = {consumedRRUs}</b><br />
                         <b>total_monthly_RRUs = monthly_executions * consumedRRUs = {monthly_executions} * {consumedRRUs} = {total_monthly_RRUs}</b><br />
                         <b>monthly_cost_base = total_monthly_RRUs * ($0.283 per million RRUs (eu-west-1)) = {total_monthly_RRUs} * ($0.283/1 000 000) = {round(total_monthly_RRUs * (0.283 / 1000000), 2)}</b><br />
                         <b>estimated_monthly_cost = monthly_cost_base + (monthly_cost_base * 0.75) = {total_monthly_cost} + {round(total_monthly_cost * 0.75, 2)} ~= {round(total_monthly_cost + round((total_monthly_cost * 0.75), 2), 2)}</b><br />
                         Remember to verify the cost using Cost Explorer!
                    </div>
                </cwdb-action>
            </th>
            </tr>
            </thead>''' #nosec not using user input here

    for alarm in alarms:
        html += '\t<tr>'
        account_id = alarm['alarmKey'].split('#')[0]
        alarm_name = alarm['alarmKey'].split('#')[1]
        region = 'unknown'
        try:
            region = alarm['alarmKey'].split('#')[2]
        except:
            region = 'unknown'
        auxiliary_info = alarm['auxiliaryInfo']
        aux_html = ""
        color = "black"
        status_label = "INS_DAT"
        if alarm["detail"]["state"]["value"] == "ALARM":
            color = "red"
            status_label = alarm["detail"]["state"]["value"]
        if alarm["detail"]["state"]["value"] == "OK":
            color = "green"
            status_label = alarm["detail"]["state"]["value"]
        html += f'''\t\t<td style="color:{color}"><a style="color:{color}">{status_label}</a>
        <cwdb-action action="call" confirmation="This will filter status {status_label}"
                endpoint="{context.invoked_function_arn}">
                {{ "state": "{alarm["detail"]["state"]["value"]}" }} 
                </cwdb-action></td>'''
        html += f'<td><a>'
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
            html += f'''</a><cwdb-action action="call" confirmation="This will filter {priority_name}"
                endpoint="{context.invoked_function_arn}">
                {{ "priority": "{alarm['priority']}" }} 
                </cwdb-action></td>'''

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

        html += f'''<td><a>{get_suppress_icon()}</a><cwdb-action action="call" confirmation="WARNING! THIS WILL SUPPRESS THIS ALARM"
                display="popup" endpoint="{configurator_lambda_function}">
            {{ "suppress": "{alarm['alarmKey']}" }}
            </cwdb-action> {alarm["detail"]["alarmName"]}<br />'''
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
        html += f'\t\t<td style="font-size: 0.8rem;">{timestamp}</td>'
        email = ""
        if "Email" in auxiliary_info["Account"]:
            email = auxiliary_info["Account"]["Email"]
        html += f'''\t\t<td><a>{account_id}</a><cwdb-action action="call" confirmation="This will filter {account_id}"
                endpoint="{context.invoked_function_arn}">
                {{ "account": "{account_id}" }} 
                </cwdb-action></td>
        
        <td style="width: 10%;"><a>{region}</a><cwdb-action action="call" confirmation="This will filter {region}"
                endpoint="{context.invoked_function_arn}">
                {{ "region": "{region}" }} 
                </cwdb-action></td><td>{email}</td>'''
        html += f'<td>'
        if 'AlternateContact' in auxiliary_info:
            if 'EmailAddress' in auxiliary_info['AlternateContact']:
                html += (
                    f'<b><a href="mailto:{auxiliary_info["AlternateContact"]["EmailAddress"]}">'
                    f'{auxiliary_info["AlternateContact"]["EmailAddress"]}</a></b>'
                    f'<br />')
            if 'PhoneNumber' in auxiliary_info['AlternateContact']:
                html += (
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
    print(len(html.encode('utf-8')))
    return html
