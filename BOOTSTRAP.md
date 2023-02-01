## Deploying without bootstraping CDK

1. Ensure you have `jq` v1.6 or higher installed.
2. Change `cdk.json` from:

```javascript
{
  "app": "npx ts-node --prefer-ts-exts bin/iem-dashboard.ts",
  "context": {

  }
}
```

to:

```javascript
{
  "app": "npx ts-node --prefer-ts-exts bin/iem-dashboard.ts && cat cdk.out/IemDashboardStack.template.json| jq '. |= del(.Rules) | del(.Parameters)'> cdk.out/clean.template.json",
  "context": {

  }
}
```

3. Deploy the `cdk.out/clean.template.json` file
