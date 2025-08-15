# Google Chat Weekly Status Bot

Automation-first weekly status collection via Google Chat with dashboard and overrides.

## Backend quick start

`ash
cd backend
cp .env.example .env
npm install
npm run dev
`

Expose http://localhost:8080/chat/events to the internet (e.g., ngrok) and set the same token in your Google Chat app and .env as CHAT_VERIFICATION_TOKEN.

## Health check
- GET http://localhost:8080/healthz  { ok: true }

## Chat webhook (MVP)
- POST http://localhost:8080/chat/events with header X-Goog-Chat-Bot-Token: <token> and JSON body; server echoes Thanks! Update received. and stores payload in memory.

See PROJECT_OUTLINE.txt for milestones.
\n## Cloud Run deployment
1) Build & push (Artifact Registry or gcloud build):
`ash
gcloud builds submit --tag gcr.io/PROJECT_ID/chat-status-backend
`
2) Deploy:
`ash
gcloud run deploy chat-status-backend --image gcr.io/PROJECT_ID/chat-status-backend --region REGION --allow-unauthenticated
`
3) Configure env vars:
- INBOUND_TOKEN (required)
- INBOUND_HEADER_NAME (optional, defaults X-Webhook-Token)
4) Apps Script script properties:
- OUTBOUND_URL: https://<cloud-run-url>/inbound/webhook
- OUTBOUND_HEADER_NAME: X-Webhook-Token
- OUTBOUND_TOKEN: same as INBOUND_TOKEN
