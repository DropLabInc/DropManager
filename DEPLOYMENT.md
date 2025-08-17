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
- Docker (for local testing - optional)

### ✅ WORKING DEPLOYMENT METHOD

**Important:** The app structure has the Node.js application in the `backend/` directory with its own `Dockerfile`. Use this proven method:

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

3. **Deploy using the backend directory (RECOMMENDED):**
   ```bash
   gcloud run deploy dropmanager \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "NODE_ENV=production,GEMINI_API_KEY=your-key,INBOUND_TOKEN=your-token,CHAT_VERIFICATION_TOKEN=your-chat-token" \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 10 \
     --timeout 300
   ```

### Alternative: Using the deployment script (NEEDS FIXING)

1. **The PowerShell script needs updating:**
   ```powershell
   # This currently fails - needs to be fixed to work from backend directory
   .\deploy-cloud-run.ps1 -ProjectId "your-project-id" -GeminiApiKey "your-key" -InboundToken "secure-token" -ChatToken "chat-token"
   ```

### Project Structure Notes

- **Main app:** Located in `backend/` directory
- **Dockerfile:** Uses multi-stage build in `backend/Dockerfile`
- **Package.json:** Node.js dependencies in `backend/package.json`
- **Built files:** TypeScript compiled to `backend/dist/`

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

## 🎉 Latest Deployment (January 2025)

**Successfully deployed to:** https://dropmanager-684432817780.us-central1.run.app

### New Features Included:
- ✅ **Analysis Caching:** Admin panel reports load instantly after first generation
- ✅ **Data Persistence:** File-based storage ensures data survives server restarts  
- ✅ **AI Analysis Agents:** Summary and Knowledge Gap agents for management insights
- ✅ **Concise Message Generation:** AI-powered, context-aware message creation
- ✅ **Enhanced Admin Dashboard:** Real-time reports with filtering and pagination

## Testing the Deployment

1. **Health Check**
   ```bash
   curl https://dropmanager-684432817780.us-central1.run.app/healthz
   ```

2. **Admin Dashboard**
   ```
   https://dropmanager-684432817780.us-central1.run.app/admin
   ```

3. **Analysis Caching (NEW)**
   ```bash
   curl https://dropmanager-684432817780.us-central1.run.app/analysis/cache/stats
   ```

4. **Test Webhook** (simulate employee update)
   ```bash
   curl -X POST https://dropmanager-684432817780.us-central1.run.app/inbound/webhook \
     -H "X-Webhook-Token: iD0NEkwszZwcR9EajFjpEzl4BsMD9QVJ" \
     -H "Content-Type: application/json" \
     -d '{"messageText":"Completed API docs","senderEmail":"test@company.com","senderName":"Test User"}'
   ```

### Performance Testing

The new caching system dramatically improves admin panel performance:
- **First request:** ~12 seconds (generates fresh analysis)
- **Subsequent requests:** <0.1 seconds (served from cache)
- **Cache duration:** 5 minutes (automatically refreshes)

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

