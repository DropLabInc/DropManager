# Google Apps Script - DropManager Chat Bot

This directory contains the Google Apps Script code that acts as the frontend for the DropManager Chat Bot system.

## 📋 Files

- **`Code.gs`** - Main Apps Script logic for handling Google Chat events
- **`appsscript.json`** - Manifest file with OAuth scopes and project configuration

## 🚀 Setup Instructions

### 1. Create Apps Script Project

1. Go to [Google Apps Script](https://script.google.com)
2. Click **"New Project"**
3. Replace the default `Code.gs` with our version
4. Create `appsscript.json` with the provided configuration

### 2. Configure Script Properties

Go to **Project Settings** → **Script properties** and add:

```
OUTBOUND_URL = https://your-cloud-run-url/inbound/webhook
OUTBOUND_HEADER_NAME = X-Webhook-Token
OUTBOUND_TOKEN = your-secret-token
```

### 3. Deploy as Web App

1. Click **Deploy** → **New deployment**
2. **Type**: Web app
3. **Execute as**: Me (your-email@domain.com)
4. **Who has access**: Anyone
5. Click **Deploy**
6. **Authorize** when prompted (grant all permissions)
7. Copy the **Web App URL** for Google Chat configuration

### 4. Set Up Google Chat App

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Create or edit your Chat app configuration
4. Set **HTTP endpoint** to your Apps Script Web App URL

## 🔐 OAuth Scopes

The `appsscript.json` file includes these required scopes:

- `script.external_request` - For HTTP calls to Cloud Run backend
- `drive.readonly` - For downloading Google Drive file attachments
- `spreadsheets` - For logging updates to Google Sheets
- `chat.messages` - For downloading Chat media attachments

## 🔧 Key Functions

### `doPost(e)`
- Entry point for Google Chat HTTP requests
- Parses incoming Chat events and calls `onMessage()`

### `onMessage(event)`
- Main message processing logic
- Handles text messages and image attachments
- Sends data to Cloud Run backend
- Logs updates to Google Sheets

### `getAttachmentBytes_(attachment)`
- Downloads Chat media or Google Drive files
- Handles both attachment types automatically

### `sendToBackend_(payload)`
- Sends multipart form data to Cloud Run
- Includes message text, files, and metadata

### `logUpdate_(info)`
- Creates/updates Google Sheets for audit trail
- Auto-creates "DropManager Updates" spreadsheet

## 🐛 Debugging

### View Execution Logs

1. In Apps Script editor, click **Executions** tab
2. Click on any execution to see detailed console logs
3. Look for `[DEBUG]` and `[ERROR]` messages

### Common Issues

**403 Permission Denied**
- Run `manualAuth()` function to trigger OAuth consent
- Ensure all required scopes are in `appsscript.json`
- Redeploy Web App after scope changes

**Backend Not Receiving Data**
- Check `OUTBOUND_URL` in Script properties
- Verify `OUTBOUND_TOKEN` matches backend configuration
- Monitor Cloud Run logs for incoming requests

**Sheets Not Created**
- Ensure `spreadsheets` scope is included
- Check if "DropManager Updates" sheet exists in Google Drive
- Look for sheet creation logs in Executions

## 📊 Data Flow

```
Google Chat Message
    ↓
doPost() receives HTTP request
    ↓
onMessage() processes event
    ↓
getAttachmentBytes_() downloads images
    ↓
sendToBackend_() sends to Cloud Run
    ↓
logUpdate_() writes to Google Sheets
    ↓
chatReply_() responds to user
```

## 🔄 Deployment Process

1. Make code changes in Apps Script editor
2. Save the project (Ctrl+S)
3. Deploy new version:
   - **Deploy** → **New deployment**
   - Or **Deploy** → **Manage deployments** → **Edit** existing
4. Test by sending a message to your Chat bot

## 📝 Testing

### Manual Testing

1. Send a text message to your Chat bot
2. Send a message with an image attachment
3. Check Apps Script **Executions** for logs
4. Verify data appears in Google Sheets
5. Confirm Cloud Run receives requests

### Manual Auth Function

Run this function in the editor to trigger OAuth consent:

```javascript
function manualAuth() {
  // Triggers OAuth consent for all required scopes
  DriveApp.getRootFolder();
  SpreadsheetApp.create('OAuth Test').getId();
  ScriptApp.getOAuthToken();
  console.log('OAuth consent completed');
}
```

## 🎯 Current Features

✅ **Working:**
- Text message processing
- Image attachment downloads (Chat + Drive)
- Multipart data transmission to backend
- Google Sheets logging
- Comprehensive error handling and logging
- Secure token-based authentication

🚧 **Future Enhancements:**
- Support for additional file types
- Message threading and context
- User authentication integration
- Advanced error recovery