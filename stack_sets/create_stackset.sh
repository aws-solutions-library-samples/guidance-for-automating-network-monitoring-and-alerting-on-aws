#!/bin/bash
if [ "$#" -ne 1 ]; then
  echo "Supply the custom eventbus ARN as argument"
  exit 1
fi

eventbus=$1

cat event_forwarder_template.yaml | sed "s|REPLACE_WITH_CENTRAL_BUS_ARN|${eventbus}|g" > event_forwarder.yaml
