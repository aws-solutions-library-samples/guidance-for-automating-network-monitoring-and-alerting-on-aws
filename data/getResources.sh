#!/bin/bash
#set -x
IFS=" 
"

TAG="iem"
TAGVALUE="202202"
REGIONS="eu-west-1 eu-north-1"
#REGIONS="eu-west-1"
TMPFILE=output.$$
TMPFILE2=output2.$$


###Get basic resources
rm -fr $TMPFILE
for region in ${REGIONS}; do
    echo $region
    aws resourcegroupstaggingapi get-resources --tag-filters Key=$TAG,Values=$TAGVALUE --region $region | jq -s '.[].ResourceTagMappingList[]' >> $TMPFILE
done

###Get the plain array of objects
cat $TMPFILE| jq -s '.' > $TMPFILE2
mv $TMPFILE2 resources.json
rm -fr $TMPFILE

### Add additional information to API-gateway endpoints ##TODO make this happen only if we found REST apis


for region in ${REGIONS}; do
IFS="
"
    echo "$region in the apiv1"
    for APIGWARN in $(aws apigateway get-rest-apis --no-paginate --region $region| jq ".items[]| select(.tags.$TAG == \"$TAGVALUE\") | .name + \" \" + .id"| sed 's/"//g'); do
        echo "Decorating APIGWV1 $APIGWARN"
        name=$(echo $APIGWARN | awk '{ print $1 }')
        endpoint=$(echo $APIGWARN | awk '{ print $2 }')
        echo "Name $name"
        echo "Endpoint $endpoint"
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"restapis\") and contains(\"$endpoint\")) |=.+{\"name\":\"$name\"}]" > $TMPFILE
        mv $TMPFILE resources.json
    done
IFS=" "
done

### Add additional information for API-gateway V2 (HTTP/WS) ##TODO make this happen only if we found HTTP/WS apis

for region in ${REGIONS}; do
IFS="
"
    echo $region
    for APIGWV2 in $(aws apigatewayv2 get-apis --no-paginate --query "Items[? Tags.\"$TAG\"=='$TAGVALUE']" --region $region| jq -r '.[] | "\(.Name) \(.ApiId) \(.ProtocolType)"'); do
        echo "Decorating APIGWV2 $APIGWV2"
        name=$(echo $APIGWV2| awk '{ print $1 }')
        apiId=$(echo $APIGWV2| awk '{ print $2 }')
        type=$(echo $APIGWV2| awk '{ print $3 }')
        echo "name" $name
        echo "type" $type
        echo "apiid" $apiId
        cat resources.json| jq ". = [ .[] | select(.ResourceARN | contains(\"apis\") and contains(\"$apiId\")) |=.+{\"name\":\"$name\",\"apiid\":\"$apiId\",\"type\":\"$type\"}]" > $TMPFILE
        mv $TMPFILE resources.json
    done
IFS=" "
done

### Dynamodb decoration
for region in ${REGIONS}; do
IFS="
"
    for DDBTABLE in $(grep dynamodb resources.json| grep $region | awk -F'/' '{ print $2 }'| sed 's/".*$//g'); do
        echo "Decorating DDB Table $DDBTABLE"
        output=$(aws dynamodb describe-table --table-name $DDBTABLE --region $region | jq -r '.Table')
        type=$(echo $output | jq 'if .BillingModeSummary then "ondemand" else "provisioned" end' | sed 's/"//g')
        echo "Type: $type"
        if [ "$type" = "provisioned" ]; then
            echo "Running provisioned"
            RCU=$(echo $output | jq '.ProvisionedThroughput.ReadCapacityUnits')
            WCU=$(echo $output | jq '.ProvisionedThroughput.WriteCapacityUnits')
            echo "wcu: $WCU, rcu: $RCU"
            cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"dynamodb\") and contains(\"$region\") and contains(\"$DDBTABLE\")) |=.+{\"type\":\"provisioned\",\"rcu\":$RCU,\"wcu\":$WCU}]" > $TMPFILE
            mv $TMPFILE resources.json
        else
            echo "Running ondemand"
            cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"dynamodb\") and contains(\"$region\") and contains(\"$DDBTABLE\")) |=.+{\"type\":\"ondemand\"}]" > $TMPFILE
            mv $TMPFILE resources.json
        fi
    done

IFS=" "
done

###RDS

###Aurora decoration
echo "Starting aurora"
for region in ${REGIONS}; do
IFS="
"
    echo "Aurora region $region"
    for AURORA in $(grep rds resources.json | grep $region | grep cluster | awk -F':' '{ print $8 }' | sed 's/".*//g'); do
        echo "Decorating Aurora $AURORA"
        output=$(aws rds describe-db-clusters --db-cluster-identifier $AURORA --region $region 2>/dev/null | jq -r '.DBClusters[]')
        if [ ! -z "$output" ]; then
            echo "Aurora $AURORA is the real cluster"
            multiaz=$(echo $output | jq '.MultiAZ')
            engine=$(echo $output | jq '.Engine' | sed 's/"//g')
            members=$(echo $output | jq -c '.DBClusterMembers' | sed 's/"/\\"/g')
            cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"rds\") and contains(\"$region\") and contains(\"$AURORA\")) |=.+{\"MultiAZ\":$multiaz,\"Engine\":\"$engine\",\"DBClusterMembers\":$members}]" > $TMPFILE
            mv $TMPFILE resources.json
        else
            echo "Aurora $AURORA is a resource"
        fi
    done
IFS=" "
done

### Autoscaling solution
for region in ${REGIONS}; do
IFS="
"
    echo $region
    for ASGARN in $(aws autoscaling describe-auto-scaling-groups --query "AutoScalingGroups[? Tags[? (Key=='$TAG') && Value=='$TAGVALUE']]".AutoScalingGroupARN --region $region| jq -r ".[]"); do
        echo "Decorating Autoscaling Group $ASGARN"
        cat resources.json| jq ".[.|length] |=.+{\"ResourceARN\": \"$ASGARN\"}" > $TMPFILE
        mv $TMPFILE resources.json
    done
IFS=" "
done


### EC2 EBS volume decoration
for region in ${REGIONS}; do
IFS="
"
    echo $region
    for EC2ID in $(grep ec2 resources.json| grep instance | grep $region | awk -F'/' '{ print $2 }' | sed 's/".*$//g'); do
        echo "Decorating EC2 instance $EC2ID"
        output=`aws ec2 describe-volumes --region $region --filters Name=attachment.instance-id,Values=$EC2ID | jq -c '.Volumes' | sed 's/"/\\"/g'`
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"ec2\") and contains(\"$region\") and contains(\"$EC2ID\")) |=.+{\"Volumes\":$output}]" > $TMPFILE
        mv $TMPFILE resources.json
        aws ec2 describe-instances --instance-ids $EC2ID --region $region | jq '.Reservations[].Instances[]' >> $TMPFILE
        grep "InstanceType" $TMPFILE | awk -F ':' '{ print $2 }' | grep "t[2,3,4]" >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          BURSTABLE=1
        fi
        output=$(cat $TMPFILE)
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"ec2\") and contains(\"$region\") and contains(\"$EC2ID\")) |=.+{\"Instance\":$output}]" > $TMPFILE
        mv $TMPFILE resources.json
        if [ -n "$BURSTABLE" ]; then
          echo "This is burstable instance $EC2ID"
          output=$(aws ec2 describe-instance-credit-specifications --instance-ids $EC2ID --region $region | jq '.InstanceCreditSpecifications[]')
          cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"ec2\") and contains(\"$region\") and contains(\"$EC2ID\")) |=.+{\"CPUCreditSpecs\":$output}]" > $TMPFILE
          mv $TMPFILE resources.json
        fi
        unset BURSTABLE
    done
IFS=" "
done


### ELB decoration
for region in ${REGIONS}; do
IFS="
"
    echo $region
    for ELB in $(grep elasticloadbalancing resources.json| grep $region | awk '{ print $2 }' | sed 's/,//g' | sed 's/"//g'); do
      echo "Decorating ELB $ELB"
      echo $ELB | grep -e '/net/' -e '/app/'
      if [ $? -eq 0 ]; then
        ELBID=$(echo $ELB | awk -F'/' '{ print $4 }')
        output=$(aws elbv2 describe-load-balancers --load-balancer-arns $ELB --region $region  | jq '.LoadBalancers[]')
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"elasticloadbalancing\") and contains(\"$region\") and contains(\"$ELBID\")) |=.+{\"Extras\":$output}]" >$TMPFILE
        mv $TMPFILE resources.json
        output=$(aws elbv2 describe-target-groups --load-balancer-arn $ELB --region $region | jq '.TargetGroups')
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"elasticloadbalancing\") and contains(\"$region\") and contains(\"$ELBID\")) |=.+{\"TargetGroups\":$output}]" > $TMPFILE
        mv $TMPFILE resources.json
      else
        ELBID=$(echo $ELB | awk -F'/' '{ print $2 }')
        output=$(aws elb describe-load-balancers --load-balancer-names $ELBID --region $region | jq '.LoadBalancerDescriptions[]')
        cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"elasticloadbalancing\") and contains(\"$region\") and contains(\"$ELBID\")) |=.+{\"Extras\":$output}]" >$TMPFILE
        mv $TMPFILE resources.json
      fi
    done
IFS=" "
done

### ECS decoration
for region in ${REGIONS}; do
IFS="
"
  echo "ECS in $region"
  for ECSCluster in $(grep ':ecs:' resources.json |grep ':cluster/' | grep $region | awk '{ print $2 }' | sed 's/,//g' | sed 's/"//g'); do
      echo "Decorating ECS cluster $ECSCluster"
      ## Get data for the cluster
      command_output=$(aws ecs describe-clusters --clusters $ECSCluster --region $region | jq ".clusters[]")
      cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"$ECSCluster\"))|=.+{\"cluster\":$command_output}]" > $TMPFILE
      mv $TMPFILE resources.json


      service_count=0
      service_def=""
      ## Get data for the services
      for ECSService in $(aws ecs list-services --cluster $ECSCluster --region $region | grep "arn:aws:ecs" |sed 's/,//g' | sed 's/"//g' | sed 's/^\ *//g'); do
        echo "Decorating ECS service $ECSService"
        aws ecs describe-services --cluster $ECSCluster --services $ECSService --region $region| jq 'del(.services[].events) | .services[]' > $TMPFILE
        grep 'launchType": "EC2"' $TMPFILE  >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          ## Each EC2 service has targets registered to it
          tgt_group=$(cat $TMPFILE | grep targetGroupArn | awk '{ print $2 }' | sed 's/,//g' | sed 's/"//g' | sed 's/^\ *//g')
          instances=$(aws elbv2 describe-target-health --target-group-arn $tgt_group  --query 'TargetHealthDescriptions[*].Target.Id' --region $region)
          command_output=$(cat $TMPFILE | jq ". |=.+{\"instances\":$instances}")
        else
          command_output=$(cat $TMPFILE)
        fi
        if [ $service_count -eq 0 ]; then
          service_def=$command_output
        else
          service_def="$service_def,$command_output"
        fi
        service_count=$(($service_count+1))
      done
      cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"$ECSCluster\"))|=.+{\"services\":[$service_def]}]" > $TMPFILE
      mv $TMPFILE resources.json
  done

IFS=" "
done


### TGW decoration
for region in ${REGIONS}; do
IFS="
"
  echo "TGW in $region"
  for TGW in $(grep 'transit-gateway/tgw-' resources.json| grep $region | grep "arn:aws:ec2" | sed 's/,//g' | sed 's/"//g' | sed 's/^\ *//g'| awk '{ print $2 }' | awk -F'/' '{ print $2 }'); do
    output=$(aws ec2 describe-transit-gateway-attachments --filters "Name=transit-gateway-id,Values=$TGW" | jq -r '[.TransitGatewayAttachments[]]')
    cat resources.json | jq ". = [ .[] | select(.ResourceARN | contains(\"$TGW\"))|=.+{\"attachments\":$output}]" > $TMPFILE
    mv $TMPFILE resources.json
  done


IFS=" "
done

