const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const SECRET_NAME = "sahayak/gemini-api-key";
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const KNOWLEDGE_BASE = `
- Baggage allowance: Economy fliers get 1 checked bag (23kg) + 1 cabin bag (7kg). Business class gets 2 checked bags (32kg each).
- Flight cancellation policy: Free cancellation up to 24 hours before departure. Cancellations within 24 hours incur a 30% fee.
- Hotel cancellation policy: Free cancellation up to 48 hours before check-in. Later cancellations forfeit the first night's charge.
- Refund timeline: Refunds are processed within 5-7 business days to the original payment method.
- Check-in/check-out: Hotel check-in is 2 PM, check-out is 11 AM. Early check-in/late check-out subject to availability.
- Flight check-in: Online check-in opens 48 hours before departure and closes 1 hour before departure for domestic flights.
- Seat selection: Standard seats are free to select. Extra-legroom and window/aisle preference seats cost ₹300-₹800 extra.
- Travel insurance: Optional travel insurance covers trip cancellation, medical emergencies, and lost baggage, starting at ₹199 per traveler.
- Payment methods accepted: Credit/debit cards, UPI, net banking, and select wallets.
- Loyalty program: Members earn 1 point per ₹100 spent, redeemable for discounts on future bookings.
`;

const getGeminiApiKey = async () => {
	const client = new SecretsManagerClient({});
	const command = new GetSecretValueCommand({ SecretId: SECRET_NAME });
	const response = await client.send(command);

	if (!response.SecretString) {
		throw new Error("SecretString is empty for Gemini API key secret");
	}

	const secretJson = JSON.parse(response.SecretString);
	if (!secretJson.apiKey) {
		throw new Error("apiKey is missing in Gemini API key secret");
	}

	return secretJson.apiKey;
};

exports.handler = async (event) => {
	try {
		const apiKey = await getGeminiApiKey();
		const userMessage = event?.message ?? "";

		const systemInstruction = `You are the Knowledge Specialist for a travel support platform. Your ONLY job is to answer
informational questions using the knowledge base below. You must NEVER invent information
that is not in the knowledge base.

Knowledge base:
${KNOWLEDGE_BASE}

Rules:
- If the answer is clearly in the knowledge base, answer concisely in 2-3 sentences.
- If the answer is NOT in the knowledge base, or you are not fully confident, respond with
  EXACTLY this JSON shape instead of a normal answer: { "answered": false, "reason": "not_in_knowledge_base" }
- If you CAN answer, respond with EXACTLY this JSON shape: { "answered": true, "response": "<your answer>" }
- Always return valid JSON only, no markdown, no extra text.`;

		const geminiResponse = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
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
						parts: [{ text: userMessage }]
					}
				],
				generationConfig: {
					responseMimeType: "application/json"
				}
			})
		});

		if (!geminiResponse.ok) {
			const errorText = await geminiResponse.text();
			throw new Error(`Gemini request failed: ${geminiResponse.status} ${errorText}`);
		}

		const data = await geminiResponse.json();
		const rawModelText =
			data?.candidates?.[0]?.content?.parts
				?.map((part) => part?.text)
				.filter(Boolean)
				.join("\n");

		if (!rawModelText) {
			throw new Error("Gemini response did not include content text");
		}

		const parsed = JSON.parse(rawModelText);

		if (parsed?.answered === true && typeof parsed?.response === "string" && parsed.response.trim()) {
			return {
				response: parsed.response.trim(),
				connectionId: event?.connectionId,
				needsEscalation: false,
				agentType: "faq"
			};
		}

		return {
			response: "I don't have reliable information on that. Let me connect you with a support specialist who can help.",
			connectionId: event?.connectionId,
			needsEscalation: true,
			agentType: "faq"
		};
	} catch (error) {
		console.error("Knowledge Specialist agent failed", error);
		return {
			response: "Sorry, I couldn't process that right now. Please try again.",
			connectionId: event?.connectionId,
			needsEscalation: true,
			agentType: "faq"
		};
	}
};
