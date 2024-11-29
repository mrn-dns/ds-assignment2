import { SNSEvent } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const snsMessage = JSON.parse(record.Sns.Message);

      if (snsMessage.Records) {
        console.log("Record body ", JSON.stringify(snsMessage));
        for (const messageRecord of snsMessage.Records) {
          const s3e = messageRecord.s3;
          const srcBucket = s3e.bucket.name;
          // Object key may have spaces or unicode non-ASCII characters.
          const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
          const { name, email, message }: ContactDetails = {
            name: "The Photo Album",
            email: SES_EMAIL_FROM,
            message: `We received your Image. Its URL is s3://${srcBucket}/${srcKey}`,
          };
          const params = sendEmailParams({ name, email, message });
          await client.send(new SendEmailCommand(params));
          console.log(`Email sent for image: s3://${srcBucket}/${srcKey}`);
        }
      }
    } catch (error: unknown) {
      console.error("Error processing record:", error);
    }
  }
};

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `New image Upload`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}
