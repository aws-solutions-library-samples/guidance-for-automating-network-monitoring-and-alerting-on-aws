#!/bin/bash
TMP=$$.tmp
if [ "$#" -ne 1 ]; then
  echo "Supply the custom eventbus ARN as argument"
  exit 1
fi

# Strip the s3//
eventbus=$1
cp event_forwarder_template.yaml event_forwarder.yaml

sed "s|REPLACE_WITH_CENTRAL_BUS_ARN|${eventbus}|g" event_forwarder.yaml > $TMP && mv $TMP event_forwarder.yaml

#cat stack_sets/event_forwarder_template.yaml | sed "s|REPLACE_WITH_CENTRAL_BUS_ARN|${eventbus}|g" > stack_sets/event_forwarder.yaml
