# Google Apps Script Setup for DropManager Chat Bot

## Files
- `Code.gs` - Main Apps Script code
- `appsscript.json` - Manifest with required permissions

## Setup Instructions

### 1. Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Replace the default `Code.gs` with the contents of `Code.gs` from this folder
4. Go to Project Settings → Show "appsscript.json" manifest file
5. Replace with the contents of `appsscript.json` from this folder

### 2. Configure Script Properties
Go to Project Settings → Script properties and add:

| Property | Value |
|----------|-------|
| `OUTBOUND_URL` | `https://chat-status-backend-684432817780.us-central1.run.app/inbound/webhook` |
| `OUTBOUND_HEADER_NAME` | `X-Webhook-Token` |
| `OUTBOUND_TOKEN` | `dropmanager-secret-2025` |

### 3. Enable APIs
In the Google Cloud Console project linked to your Apps Script:
- Google Chat API
- Google Drive API
- Google Sheets API (automatically enabled)

### 4. Authorize the Script
1. In Apps Script Editor, select `onMessage` function
2. Click the "Run" button
3. Grant all requested permissions when prompted

### 5. Deploy as Web App
1. Click "Deploy" → "New deployment"
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Click "Deploy"
6. Copy the Web App URL

### 6. Configure Google Chat App
In your Google Chat app configuration:
- Set the HTTP endpoint to your Web App URL from step 5

## What it does
- ✅ Receives Google Chat messages and images
- ✅ Downloads attached images from Chat or Drive
- ✅ Sends everything to your Cloud Run backend
- ✅ Logs all interactions to a Google Sheet
- ✅ Replies with confirmation messages

## Troubleshooting

### Bot doesn't respond
- Check Apps Script Executions tab for errors
- Ensure all permissions are granted
- Verify `chat.bot` scope is in manifest

### Permission errors
- Re-run the script to re-authorize
- Check that all required scopes are in `appsscript.json`

### Backend not receiving data
- Check Cloud Run logs: `gcloud run services logs read chat-status-backend --region=us-central1`
- Verify script properties are set correctly
- Test backend endpoint manually with curl

### Sheets not working
- Ensure `spreadsheets` scope is in manifest
- First run will create a new spreadsheet automatically
