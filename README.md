## Assignment 2 (EDA app) - Distributed Systems.

__Name:__ Denis Remus Marincas

__YouTube Demo link__ - [The URL of the video demonstration of the app.]

[ Note: The video must include an audio.]

### Phase 1.

+ Confirmation Mailer - Fully implemented.
+ Rejection Mailer - Fully implemented.
+ Log Image -  Fully implemented.

+ <b>Test Confirmation mailer: </b><ins>aws s3 cp ./images/sunflower.jpeg  s3://edastack-images9bf4dcd5-p263ocs5cett/sunflower.jpeg</ins>
+ <b>Test Rejection mailer: </b><ins>aws s3 cp ./images/error.gif  s3://edastack-images9bf4dcd5-p263ocs5cett/error.gif</ins>
### Phase 2 (if relevant).

+ Confirmation Mailer - Fully implemented.
+ Rejection Mailer - Fully implemented.
+ Log Image - Fully implemented.
+ Update Table -  Fully implemented. Also, added message.json and attributes.json to make it easier to use the update command.

+ <b>Update command: </b><ins>aws sns publish --topic-arn "arn:aws:sns:region:accountID:topicID" --message-attributes file://attributes.json --message file://message.json</ins>

### Phase 3 (if relevant).

+ Confirmation Mailer - Fully implemented. Triggered on DynamoDB add action.
+ Rejection Mailer - Fully implemented.
+ Process Image - Fully implemented.
+ Update Table - Fully implemented.

+ <b>Delete command: </b><ins>aws s3api delete-object --bucket edastack-images9bf4dcd5-1xwb81w15o6o --key image1.jpeg</ins>