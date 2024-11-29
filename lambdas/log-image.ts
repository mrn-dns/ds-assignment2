// /* eslint-disable import/extensions, import/no-absolute-path */
// import { SQSHandler } from "aws-lambda";
// import {
//   GetObjectCommand,
//   PutObjectCommandInput,
//   GetObjectCommandInput,
//   S3Client,
//   PutObjectCommand,
// } from "@aws-sdk/client-s3";

// const s3 = new S3Client();

// export const handler: SQSHandler = async (event) => {
//   console.log("Event ", JSON.stringify(event));
//   for (const record of event.Records) {
//     const recordBody = JSON.parse(record.body);        // Parse SQS message
//     const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

//     if (snsMessage.Records) {
//       console.log("Record body ", JSON.stringify(snsMessage));
//       for (const messageRecord of snsMessage.Records) {
//         const s3e = messageRecord.s3;
//         const srcBucket = s3e.bucket.name;
//         // Object key may have spaces or unicode non-ASCII characters.
//         const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
//         let origimage = null;
//         try {
//           // Download the image from the S3 source bucket.
//           const params: GetObjectCommandInput = {
//             Bucket: srcBucket,
//             Key: srcKey,
//           };
//           origimage = await s3.send(new GetObjectCommand(params));
//           // Process the image ......
//         } catch (error) {
//           console.log(error);
//         }
//       }
//     }
//   }
// };

/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";

// Initialize S3 and DynamoDB clients
const s3 = new S3Client();
const dynamodb = new DynamoDBClient({});

// Valid image extensions
const validExtensions = [".jpeg", ".png"];

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        const extension = srcKey.split(".").pop()?.toLowerCase();

        // Validate file extension
        if (!extension || !validExtensions.includes(`.${extension}`)) {
          throw new Error(`Unsupported file extension: ${extension}`);
        }

        // Add to DynamoDB table
        try {
          const params: PutItemCommandInput = {
            TableName: process.env.DYNAMODB_TABLE, // Ensure this is set in environment variables
            Item: {
              imageName: { S: srcKey }
            },
          };

          console.log("Adding image to DynamoDB:", params);
          await dynamodb.send(new PutItemCommand(params));
          console.log(`Successfully added ${srcKey} to DynamoDB.`);
        } catch (error) {
          console.error("Error adding item to DynamoDB:", error);
          throw error; // Optional: rethrow error if you want to trigger DLQ
        }

        // Process the image (Optional: Download or handle the image further)
        try {
          const getObjectParams: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          const origimage = await s3.send(new GetObjectCommand(getObjectParams));
          console.log(`Successfully retrieved object: ${srcKey}`);
          // Further processing can be done here if needed
        } catch (error) {
          console.error("Error retrieving object from S3:", error);
          throw error;
        }
      }
    }
  }
};
