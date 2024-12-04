import { SNSHandler } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

// Initialize DynamoDB client
const dynamodb = new DynamoDBClient({});

// Allowed metadata types
const ALLOWED_METADATA_TYPES = ["Caption", "Date", "Photographer"];

export const handler: SNSHandler = async (event) => {
  console.log("SNS Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      // Parse the SNS message
      const snsMessage = JSON.parse(record.Sns.Message);
      const metadataType = record.Sns.MessageAttributes.metadata_type.Value

      // Validate metadata type
      if (!metadataType || !ALLOWED_METADATA_TYPES.includes(metadataType)) {
        console.error(`Invalid or missing metadata type: ${metadataType}`);
        continue;
      }

      const { id, value } = snsMessage;

      // Validate message structure
      if (!id || !value) {
        console.error("Message body missing required fields: id or value");
        continue;
      }

      // Update DynamoDB table with metadata
      const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          imageName: { S: id },
        },
        UpdateExpression: `SET ${metadataType} = :value`,
        ExpressionAttributeValues: {
          ":value": { S: value },
        },
      };

      console.log("Updating DynamoDB with params:", params);
      await dynamodb.send(new UpdateItemCommand(params));
      console.log(`Successfully updated metadata for image: ${id}`);
    } catch (error) {
      console.error("Error processing SNS message:", error);
    }
  }
};
