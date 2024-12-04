import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";

// Initialize S3 and DynamoDB clients
const s3 = new S3Client();
const dynamodb = new DynamoDBClient({});

// Valid image extensions
const validExtensions = [".jpeg", ".png"];

export const handler: SQSHandler = async (event) => {
  console.log("Event Received:", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      for (const messageRecord of snsMessage.Records) {
        const eventName = messageRecord.eventName;
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        const extension = srcKey.split(".").pop()?.toLowerCase();

        try {
          if (eventName.startsWith("ObjectCreated")) {
            // **Handle Object Upload**
            console.log(`Processing upload for ${srcKey}`);

            // Validate file extension
            if (!extension || !validExtensions.includes(`.${extension}`)) {
              console.error(`Unsupported file extension: ${extension}`);
              throw new Error(`Unsupported file extension: ${extension}`); // Send message to DLQ
            }

            // Add item to DynamoDB
            const params: PutItemCommandInput = {
              TableName: process.env.DYNAMODB_TABLE,
              Item: {
                imageName: { S: srcKey },
              },
            };
            console.log("Adding image to DynamoDB:", params);
            await dynamodb.send(new PutItemCommand(params));
            console.log(`Successfully added ${srcKey} to DynamoDB.`);
          } else if (eventName.startsWith("ObjectRemoved")) {
            // **Handle Object Deletion**
            console.log(`Processing deletion for ${srcKey}`);
            const deleteParams = {
              TableName: process.env.DYNAMODB_TABLE,
              Key: {
                imageName: { S: srcKey },
              },
            };
            console.log("Deleting image from DynamoDB:", deleteParams);
            await dynamodb.send(new DeleteItemCommand(deleteParams));
            console.log(`Successfully deleted ${srcKey} from DynamoDB.`);
          } else {
            console.warn(`Unhandled event type: ${eventName}`);
          }
        } catch (error) {
          console.error("Error processing record:", error);
          throw error; // Ensure errors are sent to the DLQ
        }
      }
    }
  }
};
