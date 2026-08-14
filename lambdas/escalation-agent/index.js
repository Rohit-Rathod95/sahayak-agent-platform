const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const SECRET_NAME = "sahayak/gemini-api-key";
const MODEL_NAME = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;
const ESCALATIONS_TABLE = "sahayak-escalations";

const secretsClient = new SecretsManagerClient({});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function getGeminiApiKey() {
	const command = new GetSecretValueCommand({ SecretId: SECRET_NAME });
	const response = await secretsClient.send(command);

	if (!response.SecretString) {
		throw new Error("SecretString is empty for Gemini API key secret");
	}

	const secretJson = JSON.parse(response.SecretString);
	if (!secretJson.apiKey) {
		throw new Error("apiKey is missing in Gemini API key secret");
	}

	return secretJson.apiKey;
}

function extractJsonObject(text) {
	if (!text || typeof text !== "string") {
		throw new Error("Model response text is empty");
	}

	const firstBrace = text.indexOf("{");
	const lastBrace = text.lastIndexOf("}");

	if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
		throw new Error("No JSON object found in model response");
	}

	return text.slice(firstBrace, lastBrace + 1);
}

function buildCaseRecord(event, parsed, caseId) {
	return {
		caseId,
		connectionId: event?.connectionId,
		customerMessage: event?.message,
		issue: parsed.issue,
		severity: parsed.severity,
		category: parsed.category,
		customerSentiment: parsed.customerSentiment,
		recommendedAction: parsed.recommendedAction,
		status: "open",
		createdAt: new Date().toISOString()
	};
}

exports.handler = async (event) => {
	try {
		const apiKey = await getGeminiApiKey();
		const message = typeof event?.message === "string" ? event.message : "";

		const systemInstruction = `You are the Resolution Manager for a travel support platform. A customer's
issue has been escalated to you. Analyze the message and generate a structured support case.
Return ONLY valid JSON in this exact shape:
{
  "issue": "<short summary of the problem>",
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "category": "payment_issue" | "booking_failure" | "refund_dispute" | "complaint" | "other",
  "customerSentiment": "neutral" | "frustrated" | "angry",
  "recommendedAction": "<one sentence recommendation for the human support agent>"
}
Severity guidance: HIGH for payment/money issues or repeated failures, MEDIUM for booking
problems without financial loss, LOW for general complaints or unclear issues.
Return ONLY the JSON, no markdown, no extra text.`;

		const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: systemInstruction }]
				},
				contents: [
					{
						role: "user",
						parts: [{ text: message }]
					}
				],
				generationConfig: {
					responseMimeType: "application/json"
				}
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
		}

		const data = await response.json();
		const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
		const parsed = JSON.parse(extractJsonObject(modelText));

		const caseId = `CASE-${Date.now()}`;
		const caseRecord = buildCaseRecord(event, parsed, caseId);

		await ddbDocClient.send(
			new PutCommand({
				TableName: ESCALATIONS_TABLE,
				Item: caseRecord
			})
		);

		return {
			response: `I've flagged this for our support team - case ${caseId}. Someone will follow up with you shortly. In the meantime, here's a summary: ${parsed.issue}`,
			connectionId: event?.connectionId,
			caseId,
			agentType: "escalation"
		};
	} catch (error) {
		console.error("Escalation agent failed", error);

		try {
			const fallbackCase = {
				caseId: `CASE-${Date.now()}`,
				connectionId: event?.connectionId,
				customerMessage: event?.message,
				issue: "Unable to auto-analyze - manual review needed",
				severity: "MEDIUM",
				category: "other",
				customerSentiment: "unknown",
				recommendedAction: "Manual review required",
				status: "open",
				createdAt: new Date().toISOString()
			};

			await ddbDocClient.send(
				new PutCommand({
					TableName: ESCALATIONS_TABLE,
					Item: fallbackCase
				})
			);
		} catch (fallbackError) {
			console.error("Failed to write fallback escalation case", fallbackError);
		}

		return {
			response: "I've flagged this for our support team. Someone will follow up with you shortly.",
			connectionId: event?.connectionId,
			agentType: "escalation"
		};
	}
};
