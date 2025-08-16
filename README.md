# DropManager Chat Bot

A comprehensive Google Chat bot system for weekly task updates, logging, analysis, and project management. The system consists of a Google Apps Script frontend that handles Chat interactions and a Node.js backend deployed on Google Cloud Run for processing and storage.

## 🏗️ Architecture

```
Google Chat → Apps Script → Cloud Run Backend → Google Sheets
                ↓
            File Processing (Images/Attachments)
```

## ✨ Features

- **📝 Message Processing**: Handles text messages and image attachments from Google Chat
- **📊 Google Sheets Integration**: Automatically logs all updates to a spreadsheet
- **🖼️ Image Support**: Downloads and processes images from Chat and Google Drive
- **🔐 Secure Webhooks**: Token-based authentication between components
- **📈 Scalable Backend**: Cloud Run deployment with automatic scaling
- **🔍 Verbose Logging**: Comprehensive debugging and monitoring

## 🚀 Quick Start

### Prerequisites

- Google Cloud Platform account with billing enabled
- Google Apps Script access
- Google Chat API enabled

### 1. Backend Deployment

```bash
# Install dependencies
cd backend
npm install

# Local development
npm run dev
# Health check: http://localhost:3000/healthz

# Deploy to Cloud Run
cd ..
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chat-backend/backend:latest backend
gcloud run deploy chat-status-backend --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chat-backend/backend:latest --region us-central1
```

### 2. Apps Script Setup

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy `apps_script/Code.gs` and `apps_script/appsscript.json`
4. Set Script Properties:
   ```
   OUTBOUND_URL: https://your-cloud-run-url/inbound/webhook
   OUTBOUND_TOKEN: your-secret-token
   ```
5. Deploy as Web App (Execute as: Me, Access: Anyone)

### 3. Google Chat App Configuration

1. Create a Chat app in Google Cloud Console
2. Set the HTTP endpoint to your Apps Script Web App URL
3. Enable necessary scopes and permissions

## 🔧 Configuration

### Environment Variables (Cloud Run)

```bash
PORT=8080
NODE_ENV=production
CHAT_VERIFICATION_TOKEN=your-chat-token
CRON_TOKEN=your-cron-token
INBOUND_TOKEN=your-webhook-token
INBOUND_HEADER_NAME=X-Webhook-Token
```

### Apps Script Properties

```
OUTBOUND_URL=https://your-cloud-run-url/inbound/webhook
OUTBOUND_HEADER_NAME=X-Webhook-Token
OUTBOUND_TOKEN=your-webhook-token
```

## 📡 API Endpoints

### Backend Routes

- `GET /healthz` - Health check
- `POST /inbound/webhook` - Receives data from Apps Script
- `POST /chat/events` - Google Chat webhook (legacy)
- `POST /cron/weekly-reminders` - Scheduled reminders
- `POST /cron/escalations` - Task escalations
- `GET /admin/health` - Admin health check

## 🔍 Testing

### Test Chat Integration

1. Send a message to your Chat bot
2. Check Cloud Run logs:
   ```bash
   gcloud run services logs read chat-status-backend --region=us-central1 --limit=10
   ```
3. Verify Google Sheets logging

### Test with Images

1. Send a message with an image attachment
2. Monitor Apps Script executions for verbose logging
3. Confirm image data reaches Cloud Run backend

## 📋 OAuth Scopes Required

Apps Script requires these scopes in `appsscript.json`:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/chat.messages"
  ]
}
```

## 🐛 Troubleshooting

### Common Issues

1. **403 Permission Denied (Images)**
   - Ensure `chat.messages` scope is in `appsscript.json`
   - Re-authorize the Apps Script after scope changes
   - Run `manualAuth()` function in Apps Script editor

2. **Backend Not Receiving Requests**
   - Verify `OUTBOUND_URL` in Apps Script properties
   - Check `INBOUND_TOKEN` matches on both sides
   - Monitor Cloud Run logs for incoming requests

3. **Sheets Not Updating**
   - Check `spreadsheets` scope is included
   - Verify Apps Script has permission to create/write sheets
   - Look for sheet creation logs in Apps Script executions

### Debugging

- **Apps Script**: Check Executions tab for detailed logs
- **Cloud Run**: Use `gcloud run services logs read` command
- **Google Sheets**: Check for "DropManager Updates" spreadsheet in Drive

## 📚 Project Structure

```
DropManager/
├── apps_script/
│   ├── Code.gs              # Main Apps Script logic
│   ├── appsscript.json      # OAuth scopes and config
│   └── README.md            # Apps Script documentation
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Authentication middleware
│   │   ├── store/           # Data storage (memory-based MVP)
│   │   └── utils/           # Utility functions
│   ├── Dockerfile           # Container configuration
│   ├── package.json         # Node.js dependencies
│   └── tsconfig.json        # TypeScript configuration
├── PROJECT_OUTLINE.txt      # Detailed project plan
└── README.md               # This file
```

### Stories folder (local artificial test cases)

- The `Stories/` directory may be created locally to store example message transcripts and synthetic scenarios used during development and testing.
- This folder is ignored by git (see `.gitignore`) and should not contain secrets or production data.
- Use it to stage realistic inputs for local runs, load tests, and agent evaluation.

Current contents snapshot (local only, not tracked):

- Top-level helpers: `analyze_*.py`, `generate_*timeline.py`, `refine_generated_content.py`, `summarize_generated_content.py`, `requirements.txt`, `gemini_prompt.txt`, and utilities to parse and fill activity gaps
- Aggregate CSVs: `Check-ins ..._all.csv` and per-employee CSVs
- `Data/` per-person subfolders (examples):
  - `Alex/`, `Aliya/` (10 md notes), `Amir/` (12 md), `Bayan/` (46 md), `Catherine/`, `Darton/`, `Hesam/` (23 md), `Kam/` (39 md), `Kimia/` (weekly check-in md), `Mori/` (md + csv), `Nirvana/` (md + csv), `Rosemary/` (47 md + csv), `Sayan/` (csv), `Sayeh/` (md + csv), `Sergio/` (md + jpg + csv), `Shaheer/` (md + csv), `Shahzad/` (md + csv), `Tyler/` (md + csv)
  - `Weekly Updates_2024/` with ~39 PDFs of weekly updates
- `weekly_analyses/` time series of summary analyses from 2024-02-02 to 2024-12-19

These files are ideal for creating offline fixtures and evaluation runs while we iterate on the multi‑agent pipeline.

See `STORIES_GUIDE.md` for a detailed guide on how to use this content to simulate webhooks, evaluate agents, and benchmark analytics.

## 🎯 Current Status

✅ **Completed Features:**
- Google Chat message handling
- Image attachment processing
- Cloud Run backend deployment
- Google Sheets integration
- Secure webhook communication
- Comprehensive logging and debugging

🚧 **Next Steps:**
- Implement reminder scheduling
- Add Firestore for persistent storage
- Build project management dashboard
- Add task categorization and analysis

## 📝 License

This project is part of a task management system for employee weekly updates.