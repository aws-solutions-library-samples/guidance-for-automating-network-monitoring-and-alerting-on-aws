#!/bin/bash
function usage(){
if [ "$#" -ne 2 ]; then
  echo "Supply the custom eventbus ARN and Central Lambda function ARN as arguments separated by space"
  echo "$0 <EVENT_BUS_ARN> <LAMBDA_FUNCTION_ROLE>"
  exit 1
fi
}

echo "$1" | grep ":event-bus/" 2>&1 >/dev/null
if [ $? -ne 0 ]; then
  echo "First argument doesn't look like a Event Bus ARN!"
  echo ""
  usage
  exit 1
fi

echo "$2" | grep -e ":iam:" -e ":role/*" 2>&1 >/dev/null
if [ $? -ne 0 ]; then
  echo "Second argument doesn't look like an IAM Role!"
  echo ""
  usage
  exit 1
fi

eventbus=$1
functionarn=$2

cat event_forwarder_template.yaml | sed "s|REPLACE_WITH_CENTRAL_BUS_ARN|${eventbus}|g" | sed "s|REPLACE_WITH_LAMBDA_ROLE_ARN|${functionarn}|g" > event_forwarder.yaml

echo "Completed successfully, \"event_forwarder.yaml\" has been generated."