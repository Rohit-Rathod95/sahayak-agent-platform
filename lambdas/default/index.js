const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { SFNClient, StartExecutionCommand, DescribeExecutionCommand } = require("@aws-sdk/client-sfn");

const STATE_MACHINE_ARN = "arn:aws:states:us-east-1:335400931703:stateMachine:sahayak-orchestrator";
const MAX_POLL_ATTEMPTS = 30;
const POLL_DELAY_MS = 500;

exports.handler = async (event) => {
  const connectionId = event?.requestContext?.connectionId;
  const domainName = event?.requestContext?.domainName;
  const stage = event?.requestContext?.stage;
  const endpoint = `https://${domainName}/${stage}`;

  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const message = body.message ?? "";
    const sfnClient = new SFNClient({});
    const apiClient = new ApiGatewayManagementApiClient({ endpoint });

    const startResponse = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: JSON.stringify({ message, connectionId }),
      })
    );

    const executionArn = startResponse.executionArn;
    if (!executionArn) {
      throw new Error("Missing execution ARN from StartExecution response");
    }

    let describeResponse;
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
      describeResponse = await sfnClient.send(
        new DescribeExecutionCommand({ executionArn })
      );

      if (describeResponse.status === "SUCCEEDED") {
        break;
      }

      if (describeResponse.status === "FAILED") {
        throw new Error("Step Functions execution failed");
      }

      if (attempt === MAX_POLL_ATTEMPTS) {
        throw new Error("Step Functions execution polling timed out");
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
    }

    const output = describeResponse?.output ? JSON.parse(describeResponse.output) : {};

    await apiClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(output)),
      })
    );

    return {
      statusCode: 200,
    };
  } catch (error) {
    console.error("Failed to process default WebSocket route", error);

    try {
      if (connectionId && domainName && stage) {
        const apiClient = new ApiGatewayManagementApiClient({ endpoint });
        await apiClient.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(
              JSON.stringify({ response: "Something went wrong, please try again." })
            ),
          })
        );
      }
    } catch (postError) {
      console.error("Failed to send error response to WebSocket client", postError);
    }

    return {
      statusCode: 500,
    };
  }
};