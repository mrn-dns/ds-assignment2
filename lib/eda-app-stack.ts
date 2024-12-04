import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import { StreamViewType } from "aws-cdk-lib/aws-dynamodb";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { DYNAMODB_TABLE } from "env";

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    // DynamoDB table
    const dynamoTable = new cdk.aws_dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "imageName", type: cdk.aws_dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: StreamViewType.NEW_AND_OLD_IMAGES, // Added to be able to handle events such as adding or deleting items
    });

    // Dead-Letter queue
    const imageDLQ = new sqs.Queue(this, "img-dlq", {
      retentionPeriod: cdk.Duration.minutes(10),
    })

    // Image queue
    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
      deadLetterQueue: {
        queue: imageDLQ,
        maxReceiveCount: 2,
      }
    });


    // Topic creation
    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image topic",
    }); 


    // Subscribing queue to DynamoDB add/delete event
    newImageTopic.addSubscription(new subs.SqsSubscription(imageProcessQueue, {
      filterPolicyWithMessageBody: {
        Records: sns.FilterOrPolicy.policy({
          eventName: sns.FilterOrPolicy.filter(sns.SubscriptionFilter.stringFilter({
            allowlist: ["ObjectCreated:Put", "ObjectRemoved:Delete"], // Handle both upload and delete events
          })),
        }),
      },
    }));
    
    // LAMBDA FUNCTIONS

    // Confirmation-Mailer lambda
    const confirmationMailerFn = new lambdanode.NodejsFunction(this, "confirmation-mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/confirmation-mailer.ts`,
    });

    // Rejection-Mailer lambda
    const rejectionMailerFn = new lambdanode.NodejsFunction(
      this,
      "RejectionMailerFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/rejection-mailer.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 1024,
      }
    );

    // Process image lambda
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/log-image.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      environment: {
        DYNAMODB_TABLE: dynamoTable.tableName,
      },
    });

    // Update DynamoDB Table lambda
    const updateTableFn = new lambdanode.NodejsFunction(this, "UpdateTableFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      entry: `${__dirname}/../lambdas/update-table.ts`,
      environment: {
        DYNAMODB_TABLE: dynamoTable.tableName,
      },
    });

    // S3 --> SNS
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic)  
  );

    // S3 --> SNS
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.SnsDestination(newImageTopic)
    );
  

   // SQS --> Lambda
    const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    // SQS --> Lambda
    const rejectionMailEventSource = new events.SqsEventSource(imageDLQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    // SNS --> Lambda
    newImageTopic.addSubscription(new subs.LambdaSubscription(updateTableFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ["Caption", "Date", "Photographer"]
          }),
        }
      })
    )

    confirmationMailerFn.addEventSource(new DynamoEventSource(dynamoTable, {
      startingPosition: StartingPosition.LATEST, // Start from the latest records
      batchSize: 5,                             // Process up to 5 records per batch
      retryAttempts: 2,                         // Retry twice if Lambda invocation fails
    }));

    logImageFn.addEventSource(newImageEventSource);
    rejectionMailerFn.addEventSource(rejectionMailEventSource);

    // Permissions

    imagesBucket.grantRead(logImageFn);

    dynamoTable.grantReadWriteData(logImageFn);
    dynamoTable.grantReadWriteData(updateTableFn);

    confirmationMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    rejectionMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
