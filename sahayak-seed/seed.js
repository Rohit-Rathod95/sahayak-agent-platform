const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "sahayak-inventory";

const items = [
  // Flights
  { itemId: "FL-001", type: "flight", origin: "Mumbai", destination: "Goa", date: "2026-08-20", airline: "IndiGo", price: 4500, seatsAvailable: 12 },
  { itemId: "FL-002", type: "flight", origin: "Mumbai", destination: "Goa", date: "2026-08-20", airline: "Air India", price: 5200, seatsAvailable: 8 },
  { itemId: "FL-003", type: "flight", origin: "Delhi", destination: "Goa", date: "2026-08-21", airline: "SpiceJet", price: 6100, seatsAvailable: 5 },
  { itemId: "FL-004", type: "flight", origin: "Pune", destination: "Goa", date: "2026-08-22", airline: "IndiGo", price: 3900, seatsAvailable: 15 },
  { itemId: "FL-005", type: "flight", origin: "Bangalore", destination: "Goa", date: "2026-08-20", airline: "Vistara", price: 4800, seatsAvailable: 0 },
  { itemId: "FL-006", type: "flight", origin: "Mumbai", destination: "Delhi", date: "2026-08-25", airline: "IndiGo", price: 5500, seatsAvailable: 20 },
  { itemId: "FL-007", type: "flight", origin: "Chennai", destination: "Goa", date: "2026-08-23", airline: "Air India", price: 5900, seatsAvailable: 6 },

  // Hotels
  { itemId: "HT-001", type: "hotel", city: "Goa", name: "Beachside Resort", roomType: "Deluxe", pricePerNight: 3200, roomsAvailable: 5 },
  { itemId: "HT-002", type: "hotel", city: "Goa", name: "Beachside Resort", roomType: "Suite", pricePerNight: 5800, roomsAvailable: 2 },
  { itemId: "HT-003", type: "hotel", city: "Goa", name: "Palm Grove Inn", roomType: "Standard", pricePerNight: 2100, roomsAvailable: 10 },
  { itemId: "HT-004", type: "hotel", city: "Goa", name: "Palm Grove Inn", roomType: "Deluxe", pricePerNight: 3400, roomsAvailable: 0 },
  { itemId: "HT-005", type: "hotel", city: "Mumbai", name: "City Comfort Hotel", roomType: "Standard", pricePerNight: 2800, roomsAvailable: 8 },
  { itemId: "HT-006", type: "hotel", city: "Delhi", name: "Grand Capital Suites", roomType: "Deluxe", pricePerNight: 4200, roomsAvailable: 4 },
  { itemId: "HT-007", type: "hotel", city: "Goa", name: "Sunset Villas", roomType: "Villa", pricePerNight: 7500, roomsAvailable: 3 },
];

async function seed() {
  console.log(`Seeding ${items.length} items into ${TABLE_NAME}...`);
  for (const item of items) {
    try {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      console.log(`  ✓ ${item.itemId}`);
    } catch (err) {
      console.error(`  ✗ ${item.itemId} failed:`, err.message);
    }
  }
  console.log("Done.");
}

seed();