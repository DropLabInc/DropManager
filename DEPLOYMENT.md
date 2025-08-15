# DropManager Deployment Guide

## Local Development

1. **Install Dependencies**
   ```bash
   cd backend
   npm ci
   ```

2. **Set Environment Variables**
   ```bash
   cp env.example .env
   # Edit .env with your values
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   # Or build and run:
   npm run build
   node dist/index.js
   ```

4. **Access Dashboard**
   - Admin Dashboard: http://localhost:8080/admin
   - API Health: http://localhost:8080/healthz
   - Dashboard API: http://localhost:8080/dashboard/overview

## Google Cloud Run Deployment

### Prerequisites
- Google Cloud CLI installed and authenticated
- Google Cloud project with billing enabled
- Docker (for local testing)

### Quick Deploy

1. **Using the deployment script:**
   ```powershell
   .\deploy-cloud-run.ps1 -ProjectId "your-project-id" -GeminiApiKey "your-key" -InboundToken "secure-token" -ChatToken "chat-token"
   ```

2. **Manual deployment:**
   ```bash
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   
   # Enable APIs
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com
   
   # Deploy
   gcloud run deploy dropmanager \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "GEMINI_API_KEY=your-key,INBOUND_TOKEN=your-token,CHAT_VERIFICATION_TOKEN=your-chat-token"
   ```

### Environment Variables for Production

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini AI API key for NLP features | No (fallback used) |
| `INBOUND_TOKEN` | Security token for webhook authentication | Yes |
| `CHAT_VERIFICATION_TOKEN` | Google Chat bot verification token | Yes |
| `PORT` | Server port (auto-set by Cloud Run) | No |
| `NODE_ENV` | Environment mode | No |

## Google Chat Integration

1. **Create Google Chat App**
   - Go to Google Chat API console
   - Create new app
   - Set webhook URL to: `https://your-service-url/inbound/webhook`
   - Set verification token

2. **Configure Webhook Headers**
   - Header name: `X-Webhook-Token` (or custom via `INBOUND_HEADER_NAME`)
   - Header value: Your `INBOUND_TOKEN` value

## Testing the Deployment

1. **Health Check**
   ```bash
   curl https://your-service-url/healthz
   ```

2. **Dashboard**
   ```
   https://your-service-url/admin
   ```

3. **Test Webhook** (simulate employee update)
   ```bash
   curl -X POST https://your-service-url/inbound/webhook \
     -H "X-Webhook-Token: your-token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "messageText=Completed API docs&senderEmail=test@company.com&senderDisplay=Test User"
   ```

## Architecture

- **Backend**: Node.js/Express server with TypeScript
- **NLP**: Google Gemini AI for task extraction and sentiment analysis
- **Storage**: In-memory (easily replaceable with Firestore/database)
- **Frontend**: Server-rendered HTML dashboard
- **Deployment**: Docker container on Google Cloud Run

## Security Notes

- All webhook endpoints require authentication tokens
- Admin dashboard has no authentication (add auth as needed)
- Environment variables contain sensitive data
- HTTPS enforced in production via Cloud Run

