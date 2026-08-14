
# Sahayak — AI-Powered Travel Support Platform

A multi-agent customer support platform for travel bookings, built on AWS serverless
infrastructure. A single chat interface routes customer queries to specialized AI
agents — each backed by Gemini function-calling and live DynamoDB inventory — instead
of relying on one generalist chatbot.

**Live demo:** *(add your deployed frontend URL here once hosted, e.g. Vercel/Netlify)*

---

## Why multi-agent, not a single chatbot

A single LLM prompt handling FAQs, bookings, and complaints in one flow tends to blur
responsibilities — it either over-promises on transactions it can't verify, or gives
shallow answers across the board. Sahayak splits the work the way a real support team
is structured:

| Agent | Responsibility |
|---|---|
| **Knowledge Specialist** | Answers policy/info questions grounded in a fixed knowledge base. Refuses to answer (and flags for handoff) rather than hallucinate. |
| **Travel Operations Specialist** | Uses Gemini function-calling to search live flight/hotel inventory and create real bookings against DynamoDB — never confirms a transaction the backend hasn't verified. |
| **Resolution Manager** | Generates a structured support case (severity, category, sentiment, recommended action) for escalations, instead of a generic "connecting you to an agent" reply. |

A Step Functions state machine classifies each incoming message and routes it to the
correct specialist.

---

## Architecture

```
Browser (React)
   │  WebSocket
   ▼
API Gateway (WebSocket API)
   │
   ▼
Lambda ($connect / $disconnect / $default)
   │  starts execution
   ▼
Step Functions — sahayak-orchestrator
   │
   ├─▶ Classifier Lambda ──(Gemini)──▶ intent: faq | booking | escalation
   │
   ├─▶ Knowledge Specialist Lambda ──(Gemini, grounded KB)
   │
   ├─▶ Travel Ops Specialist Lambda ──(Gemini function-calling)──▶ DynamoDB (inventory, bookings)
   │
   └─▶ Resolution Manager Lambda ──(Gemini, structured JSON)──▶ DynamoDB (escalations)
```

**AWS services:** Lambda, Step Functions, API Gateway (WebSocket), DynamoDB, Secrets Manager
**AI:** Gemini 3 Flash — intent classification, grounded RAG-lite QA, function-calling, structured JSON generation
**Frontend:** React (Vite), WebSocket client

---

## Key engineering details

- **Grounded answers, not hallucination.** The Knowledge Specialist is instructed to
  answer only from a fixed knowledge base and returns a structured "I don't know" signal
  otherwise, which the UI surfaces as an escalation flag.
- **No phantom bookings.** The Travel Operations Specialist checks live
  `seatsAvailable` / `roomsAvailable` before writing a booking, and decrements
  inventory atomically after a successful write — tested against sold-out items to
  confirm it fails gracefully instead of confirming a booking that can't be honored.
- **Structured escalation, not a form letter.** The Resolution Manager returns severity,
  category, customer sentiment, and a specific recommended action for a human agent —
  generated per-case by Gemini, not templated.
- **IAM least-privilege throughout.** Each Lambda has its own execution role scoped to
  only the resources it touches (Secrets Manager for the API key, specific DynamoDB
  tables, `execute-api:ManageConnections` for the WebSocket push).

---

## Local setup

### Backend
Each Lambda in `/lambdas` is deployed independently via the AWS Console (or adapt to
your IaC tool of choice). Requires:
- A Gemini API key stored in Secrets Manager as `sahayak/gemini-api-key` (key: `apiKey`)
- DynamoDB tables: `sahayak-connections`, `sahayak-inventory`, `sahayak-bookings`, `sahayak-escalations`
- Seed inventory: `cd sahayak-seed && npm install && node seed.js`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Roadmap
- [ ] Public REST endpoint for live inventory on the landing page (booking handoff into chat)
- [ ] CloudWatch/X-Ray tracing across the full agent pipeline
- [ ] Multi-key rotation for Gemini free-tier rate limits during heavy testing