const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const secretsClient = new SecretsManagerClient({});
const SECRET_NAME = "sahayak/gemini-api-key";
const MODEL_NAME = "gemini-2.5-flash";
const DEFAULT_RESULT = { intent: "escalation", confidence: 0 };

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

function normalizeResult(parsed) {
	const validIntents = new Set(["faq", "booking", "escalation"]);
	const intent = typeof parsed?.intent === "string" ? parsed.intent.toLowerCase().trim() : "";
	const confidence = Number(parsed?.confidence);

	if (!validIntents.has(intent) || Number.isNaN(confidence)) {
		throw new Error("Invalid classification payload");
	}

	return { intent, confidence };
}

async function getGeminiApiKey() {
	const command = new GetSecretValueCommand({ SecretId: SECRET_NAME });
	const response = await secretsClient.send(command);

	if (!response.SecretString) {
		throw new Error("SecretString not found for Gemini API key secret");
	}

	try {
		const parsedSecret = JSON.parse(response.SecretString);
		if (typeof parsedSecret === "string" && parsedSecret.trim()) {
			return parsedSecret.trim();
		}

		if (typeof parsedSecret.apiKey === "string" && parsedSecret.apiKey.trim()) {
			return parsedSecret.apiKey.trim();
		}

		if (typeof parsedSecret.GEMINI_API_KEY === "string" && parsedSecret.GEMINI_API_KEY.trim()) {
			return parsedSecret.GEMINI_API_KEY.trim();
		}
	} catch {
		if (response.SecretString.trim()) {
			return response.SecretString.trim();
		}
	}

	throw new Error("Unable to resolve Gemini API key from secret");
}

exports.handler = async (event) => {
	try {
		const message = typeof event?.message === "string" ? event.message.trim() : "";

		if (!message) {
			return DEFAULT_RESULT;
		}

		const apiKey = await getGeminiApiKey();
		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;

		const systemInstruction = `You are an intent classifier for chat routing. Classify the user's message into exactly one intent from this set only: "faq", "booking", "escalation". Return ONLY valid JSON in this exact shape: { "intent": "faq" | "booking" | "escalation", "confidence": number }. Do not include markdown, backticks, or any extra keys/text.`;

		const response = await fetch(endpoint, {
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
					temperature: 0,
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
		return normalizeResult(parsed);
	} catch (error) {
		console.error("Classifier handler failed, defaulting to escalation:", error);
		return DEFAULT_RESULT;
	}
};
