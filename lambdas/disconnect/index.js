const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "sahayak-connections";

const dynamoDbClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

exports.handler = async (event) => {
  const connectionId = event?.requestContext?.connectionId;

  try {
    await documentClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          connectionId,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Disconnected" }),
    };
  } catch (error) {
    console.error("Failed to delete connection", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to delete connection" }),
    };
  }
};