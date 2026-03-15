

import * as aws from "@pulumi/aws";

export const userPool = new sst.aws.CognitoUserPool("DrainMonitoringPool", {
  usernames: ["email"],
});

export const operatorsGroup = new aws.cognito.UserGroup("OperatorsGroup", {
  userPoolId: userPool.id,
  name: "Operators",
  description: "Group for drain monitoring operators",
  precedence: 1,
});