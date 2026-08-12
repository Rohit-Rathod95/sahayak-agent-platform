const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

exports.handler = async (event) => {
  const connectionId = event?.requestContext?.connectionId;
  const domainName = event?.requestContext?.domainName;
  const stage = event?.requestContext?.stage;
  const endpoint = `https://${domainName}/${stage}`;

  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const message = body.message ?? "";

    const client = new ApiGatewayManagementApiClient({ endpoint });

    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify({ message })),
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message }),
    };
  } catch (error) {
    console.error("Failed to echo message", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to echo message" }),
    };
  }
};