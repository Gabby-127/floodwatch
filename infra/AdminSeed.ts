
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { userPool } from "./cognito";

export const adminSeedFunction = new aws.lambda.Function("AdminSeedFunction", {
  runtime: aws.lambda.Runtime.NodeJS20dX,
  handler: "index.handler",
  role: new aws.iam.Role("AdminSeedRole", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
      }],
    }),
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    ],
    inlinePolicies: [{
      name: "CognitoAdminPolicy",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Action: [
            "cognito-idp:AdminCreateUser",
            "cognito-idp:AdminAddUserToGroup",
            "cognito-idp:AdminGetUser",
          ],
          Resource: "*",
        }],
      }),
    }],
  }).arn,
  code: new pulumi.asset.AssetArchive({
    "index.js": new pulumi.asset.StringAsset(`
      const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
      const client = new CognitoIdentityProviderClient({});

      exports.handler = async () => {
        const userPoolId = process.env.USER_POOL_ID;
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_TEMP_PASSWORD;
        const firstName = process.env.ADMIN_FIRST_NAME;
        const lastName = process.env.ADMIN_LAST_NAME;

        // Check if admin already exists
        try {
          await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }));
          console.log("Admin user already exists, skipping creation.");
          return { status: "already_exists" };
        } catch (e) {
          if (e.name !== "UserNotFoundException") throw e;
        }

        // Create admin user
        await client.send(new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "given_name", Value: firstName },
            { Name: "family_name", Value: lastName },
          ],
          TemporaryPassword: password,
          MessageAction: "SUPPRESS",
        }));

        // Add to Operators group
        await client.send(new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: email,
          GroupName: "Operators",
        }));

        console.log("Admin user created successfully.");
        return { status: "created" };
      };
    `),
  }),
  environment: {
    variables: {
      USER_POOL_ID: userPool.id,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
      ADMIN_TEMP_PASSWORD: process.env.ADMIN_TEMP_PASSWORD || "Admin@2026",
      ADMIN_FIRST_NAME: process.env.ADMIN_FIRST_NAME || "Admin",
      ADMIN_LAST_NAME: process.env.ADMIN_LAST_NAME || "User",
    },
  },
});

// Invoke the Lambda once on every deploy
export const adminSeedInvocation = new aws.lambda.Invocation("AdminSeedInvocation", {
  functionName: adminSeedFunction.name,
  input: JSON.stringify({ trigger: "deploy" }),
}, { dependsOn: [adminSeedFunction] });