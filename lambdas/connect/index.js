const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "sahayak-connections";

const dynamoDbClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

exports.handler = async (event) => {
  const connectionId = event?.requestContext?.connectionId;

  try {
    await documentClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          connectionId,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Connected" }),
    };
  } catch (error) {
    console.error("Failed to save connection", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to save connection" }),
    };
  }
};