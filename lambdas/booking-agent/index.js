const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const SECRET_NAME = "sahayak/gemini-api-key";
const MODEL_NAME = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;
const INVENTORY_TABLE = "sahayak-inventory";
const BOOKINGS_TABLE = "sahayak-bookings";

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

function asString(value) {
	return typeof value === "string" ? value.trim() : "";
}

function findFunctionCall(data) {
	const parts = data?.candidates?.[0]?.content?.parts;
	if (!Array.isArray(parts)) {
		return null;
	}

	for (const part of parts) {
		if (part?.functionCall?.name) {
			return part.functionCall;
		}
	}

	return null;
}

function getModelText(data) {
	const parts = data?.candidates?.[0]?.content?.parts;
	if (!Array.isArray(parts)) {
		return "";
	}

	return parts
		.map((part) => (typeof part?.text === "string" ? part.text : ""))
		.filter(Boolean)
		.join("\n")
		.trim();
}

function formatFlight(item) {
	const airline = asString(item?.airline) || asString(item?.provider) || "Flight";
	const price = item?.price != null ? `Rs${item.price}` : "price unavailable";
	const date = asString(item?.date) || "date unavailable";
	const seats = Number(item?.seatsAvailable);
	const seatsText = Number.isFinite(seats) ? `${seats} seats left` : "seats info unavailable";
	return `${airline} ${price} on ${date} (${seatsText}) [${item?.itemId || "no-id"}]`;
}

function formatHotel(item) {
	const name = asString(item?.name) || asString(item?.hotelName) || "Hotel";
	const price = item?.pricePerNight != null ? `Rs${item.pricePerNight}/night` : "price unavailable";
	const rooms = Number(item?.roomsAvailable);
	const roomsText = Number.isFinite(rooms) ? `${rooms} rooms left` : "rooms info unavailable";
	return `${name} ${price} (${roomsText}) [${item?.itemId || "no-id"}]`;
}

function formatBookedItem(item) {
	if (item?.type === "flight") {
		const airline = asString(item?.airline) || asString(item?.provider) || "flight";
		const origin = asString(item?.origin);
		const destination = asString(item?.destination);
		const route = origin && destination ? `${origin} to ${destination}` : "your selected route";
		const date = asString(item?.date) || "your selected date";
		return `${airline} (${route} on ${date})`;
	}

	if (item?.type === "hotel") {
		const name = asString(item?.name) || asString(item?.hotelName) || "hotel";
		const city = asString(item?.city);
		return city ? `${name} in ${city}` : name;
	}

	return `item ${item?.itemId || "unknown"}`;
}

async function runFlightSearch(args) {
	const destination = asString(args?.destination);
	if (!destination) {
		return { ok: false, reason: "missing_destination", items: [] };
	}

	const expressionNames = {
		"#type": "type",
		"#destination": "destination",
		"#seatsAvailable": "seatsAvailable"
	};
	const expressionValues = {
		":type": "flight",
		":destination": destination,
		":zero": 0
	};

	let filterExpression = "#type = :type AND #destination = :destination AND #seatsAvailable > :zero";

	const origin = asString(args?.origin);
	if (origin) {
		expressionNames["#origin"] = "origin";
		expressionValues[":origin"] = origin;
		filterExpression += " AND #origin = :origin";
	}

	const date = asString(args?.date);
	if (date) {
		expressionNames["#date"] = "date";
		expressionValues[":date"] = date;
		filterExpression += " AND #date = :date";
	}

	const result = await ddbDocClient.send(
		new ScanCommand({
			TableName: INVENTORY_TABLE,
			FilterExpression: filterExpression,
			ExpressionAttributeNames: expressionNames,
			ExpressionAttributeValues: expressionValues,
			Limit: 50
		})
	);

	const items = (result.Items || []).slice(0, 5);
	return { ok: true, items };
}

async function runHotelSearch(args) {
	const city = asString(args?.city);
	if (!city) {
		return { ok: false, reason: "missing_city", items: [] };
	}

	const result = await ddbDocClient.send(
		new ScanCommand({
			TableName: INVENTORY_TABLE,
			FilterExpression: "#type = :type AND #city = :city AND #roomsAvailable > :zero",
			ExpressionAttributeNames: {
				"#type": "type",
				"#city": "city",
				"#roomsAvailable": "roomsAvailable"
			},
			ExpressionAttributeValues: {
				":type": "hotel",
				":city": city,
				":zero": 0
			},
			Limit: 50
		})
	);

	const items = (result.Items || []).slice(0, 5);
	return { ok: true, items };
}

async function runCreateBooking(args, connectionId) {
	try {
		const itemId = asString(args?.itemId);
		const customerName = asString(args?.customerName);

		if (!itemId || !customerName) {
			return { ok: false, reason: "missing_fields" };
		}

		const inventoryResult = await ddbDocClient.send(
			new GetCommand({
				TableName: INVENTORY_TABLE,
				Key: { itemId }
			})
		);

		const item = inventoryResult.Item;
		if (!item) {
			return { ok: false, reason: "not_found" };
		}

		const isFlight = item.type === "flight";
		const isHotel = item.type === "hotel";
		const availabilityField = isFlight ? "seatsAvailable" : isHotel ? "roomsAvailable" : null;

		if (!availabilityField) {
			return { ok: false, reason: "unsupported_item" };
		}

		const available = Number(item[availabilityField]);
		if (!Number.isFinite(available) || available <= 0) {
			return { ok: false, reason: "no_availability", item };
		}

		const bookingId = `BK-${Date.now()}`;
		const booking = {
			bookingId,
			itemId,
			customerName,
			itemDetails: item,
			status: "confirmed",
			createdAt: new Date().toISOString(),
			connectionId
		};

		await ddbDocClient.send(
			new PutCommand({
				TableName: BOOKINGS_TABLE,
				Item: booking
			})
		);

		await ddbDocClient.send(
			new UpdateCommand({
				TableName: INVENTORY_TABLE,
				Key: { itemId },
				UpdateExpression: "SET #availability = #availability - :one",
				ConditionExpression: "#availability > :zero",
				ExpressionAttributeNames: {
					"#availability": availabilityField
				},
				ExpressionAttributeValues: {
					":one": 1,
					":zero": 0
				}
			})
		);

		return { ok: true, booking };
	} catch (error) {
		console.error("create_booking execution failed", error);
		return { ok: false, reason: "system_error" };
	}
}

exports.handler = async (event) => {
	try {
		const message = asString(event?.message);
		if (!message) {
			return {
				response: "Please share what travel help you need, such as finding flights or hotels.",
				connectionId: event?.connectionId,
				needsEscalation: false
			};
		}

		const apiKey = await getGeminiApiKey();
		const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [
						{
							text: "You are the Travel Operations Specialist for a travel platform. Extract the user's request and call the appropriate tool (search_flights, search_hotels, or create_booking). Only call create_booking if the user has clearly specified which item to book (by itemId or by clearly referring to a specific search result) and provided their name; otherwise call a search function first. If you cannot determine what the user wants, do not call any function."
						}
					]
				},
				contents: [
					{
						role: "user",
						parts: [{ text: message }]
					}
				],
				tools: [
					{
						functionDeclarations: [
							{
								name: "search_flights",
								description: "Search available flights for a route and date.",
								parameters: {
									type: "OBJECT",
									properties: {
										origin: {
											type: "STRING",
											description: "Origin city or airport code."
										},
										destination: {
											type: "STRING",
											description: "Destination city or airport code."
										},
										date: {
											type: "STRING",
											description: "Travel date in YYYY-MM-DD format if available."
										}
									},
									required: ["destination"]
								}
							},
							{
								name: "search_hotels",
								description: "Search available hotels for a city and optional stay dates.",
								parameters: {
									type: "OBJECT",
									properties: {
										city: {
											type: "STRING",
											description: "City where the user wants a hotel."
										},
										checkIn: {
											type: "STRING",
											description: "Requested check-in date in YYYY-MM-DD format."
										},
										checkOut: {
											type: "STRING",
											description: "Requested check-out date in YYYY-MM-DD format."
										}
									},
									required: ["city"]
								}
							},
							{
								name: "create_booking",
								description: "Create a confirmed booking for a selected inventory item.",
								parameters: {
									type: "OBJECT",
									properties: {
										itemId: {
											type: "STRING",
											description: "The selected flight or hotel item ID to book."
										},
										customerName: {
											type: "STRING",
											description: "The traveler's full name for the booking confirmation."
										}
									},
									required: ["itemId", "customerName"]
								}
							}
						]
					}
				]
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
		}

		const data = await response.json();
		const functionCall = findFunctionCall(data);

		if (!functionCall) {
			const modelText = getModelText(data);
			return {
				response:
					modelText ||
					"Could you clarify whether you want to search flights, search hotels, or create a booking?",
				connectionId: event?.connectionId,
				needsEscalation: false
			};
		}

		const name = functionCall.name;
		const args = functionCall.args || {};

		if (name === "search_flights") {
			const result = await runFlightSearch(args);
			if (!result.ok || result.items.length === 0) {
				return {
					response: "I couldn't find any matching flights/hotels. Could you try different dates or destination?",
					connectionId: event?.connectionId,
					needsEscalation: false
				};
			}

			const listed = result.items.map(formatFlight).join(", ");
			return {
				response: `I found ${result.items.length} flights: ${listed}`,
				connectionId: event?.connectionId,
				needsEscalation: false
			};
		}

		if (name === "search_hotels") {
			const result = await runHotelSearch(args);
			if (!result.ok || result.items.length === 0) {
				return {
					response: "I couldn't find any matching flights/hotels. Could you try different dates or destination?",
					connectionId: event?.connectionId,
					needsEscalation: false
				};
			}

			const listed = result.items.map(formatHotel).join(", ");
			return {
				response: `I found ${result.items.length} hotels: ${listed}`,
				connectionId: event?.connectionId,
				needsEscalation: false
			};
		}

		if (name === "create_booking") {
			const bookingResult = await runCreateBooking(args, event?.connectionId);

			if (bookingResult.ok) {
				const details = formatBookedItem(bookingResult.booking.itemDetails);
				return {
					response: `Your booking is confirmed! Booking ID: ${bookingResult.booking.bookingId} for ${details}.`,
					connectionId: event?.connectionId,
					needsEscalation: false
				};
			}

			if (bookingResult.reason === "system_error") {
				return {
					response: "Sorry, I couldn't process your travel request right now. Let me connect you with support.",
					connectionId: event?.connectionId,
					needsEscalation: true
				};
			}

			if (bookingResult.reason === "no_availability") {
				return {
					response: "Sorry, that item is no longer available. Would you like to see other options?",
					connectionId: event?.connectionId,
					needsEscalation: false
				};
			}

			if (bookingResult.reason === "not_found") {
				return {
					response: "I could not find that travel option anymore. Would you like me to show alternatives?",
					connectionId: event?.connectionId,
					needsEscalation: false
				};
			}

			return {
				response: "Please share the item ID and traveler name to complete your booking.",
				connectionId: event?.connectionId,
				needsEscalation: false
			};
		}

		const fallbackText = getModelText(data);
		return {
			response: fallbackText || "Could you clarify your request so I can help with flights, hotels, or booking?",
			connectionId: event?.connectionId,
			needsEscalation: false
		};
	} catch (error) {
		console.error("Booking agent handler failed", error);
		return {
			response: "Sorry, I couldn't process your travel request right now. Let me connect you with support.",
			connectionId: event?.connectionId,
			needsEscalation: true
		};
	}
};
