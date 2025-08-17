// Google Chat → Cloud Run webhook (text + ALL images) + Google Sheets logging
// Script properties to configure in Project Settings → Script properties:
//   OUTBOUND_URL: https://chat-status-backend-n6gd7xskyq-uc.a.run.app/inbound/webhook
//   OUTBOUND_HEADER_NAME: X-Webhook-Token (optional, this is the default)
//   OUTBOUND_TOKEN: dropmanager-secret-2025

const MAX_SNIPPET = 400;

// Global variable to store backend response
var lastBackendResponse = null;

// Web App HTTP endpoint (for Google Chat HTTP bot configuration)
function doPost(e) {
  console.log('[DEBUG] doPost called with:', JSON.stringify(e, null, 2));
  try {
    var bodyText = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    console.log('[DEBUG] Body text:', bodyText);
    var event = {};
    try { 
      event = JSON.parse(bodyText); 
      console.log('[DEBUG] Parsed event:', JSON.stringify(event, null, 2));
    } catch (parseErr) { 
      console.error('[ERROR] Failed to parse body:', parseErr);
      event = {}; 
    }

    // New: server-initiated proactive message API
    // Expect payload: { op: 'send', sendToken: '...', spaceName: 'spaces/..', threadName?: 'threads/..', text: '...' }
    if (event && event.op === 'send') {
      try {
        var props = PropertiesService.getScriptProperties();
        var expected = (props.getProperty('SEND_TOKEN') || '').trim();
        var provided = (event.sendToken || '').trim();
        if (!expected) {
          throw new Error('SEND_TOKEN not configured in script properties');
        }
        if (!provided || provided !== expected) {
          throw new Error('Unauthorized: invalid send token');
        }

        if (!event.spaceName || !event.text) {
          throw new Error('Missing spaceName or text');
        }

        var sendRes = sendChatMessage_(event.spaceName, event.threadName || '', event.text);
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true, sent: true, result: sendRes }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (sendErr) {
        console.error('[ERROR] Proactive send failed:', sendErr);
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: String(sendErr).slice(0, MAX_SNIPPET) }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    var resp = onMessage(event);
    console.log('[DEBUG] onMessage response:', JSON.stringify(resp, null, 2));
    return ContentService
      .createTextOutput(JSON.stringify(resp || { text: 'OK' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('[ERROR] doPost error:', err);
    var msg = (err && (err.message || err.stack)) ? String(err.message || err.stack) : String(err);
    return ContentService
      .createTextOutput(JSON.stringify({ text: '⚠️ Error: ' + msg.slice(0, MAX_SNIPPET) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function onMessage(event) {
  console.log('[DEBUG] onMessage called with event:', JSON.stringify(event, null, 2));
  
  try {
    if (!event?.chat) {
      console.error('[ERROR] No event.chat found');
      throw new Error('No event.chat');
    }

    var p = event.chat.messagePayload;
    console.log('[DEBUG] Message payload:', JSON.stringify(p, null, 2));
    
    var senderName = p.space?.type === 'DM' ? 'You' : (event.chat?.user?.displayName || 'User');
    var text = p.message?.text || p.text || '';
    console.log('[DEBUG] Extracted text:', text);
    console.log('[DEBUG] Sender name:', senderName);

    // Extract Chat identifiers
    var spaceName = p.message?.space?.name || p.space?.name || '';
    var threadName = p.message?.thread?.name || '';
    var messageName = p.message?.name || '';
    var senderEmail = p.message?.sender?.email || event.chat?.user?.email || '';
    var senderDisplay = p.message?.sender?.displayName || event.chat?.user?.displayName || '';
    var spaceType = p.space?.type || p.message?.space?.type || '';
    // Additional identifiers to support cases where Chat omits senderEmail
    var senderId = p.message?.sender?.name || event.chat?.user?.name || '';
    // Deterministic fallback identifier when email is unavailable
    var fallbackId = Utilities.base64EncodeWebSafe([senderDisplay || 'Unknown User', spaceName || '', threadName || ''].join('|'));
    
    console.log('[DEBUG] Chat metadata:', {
      spaceName: spaceName, threadName: threadName, messageName: messageName,
      senderEmail: senderEmail, senderDisplay: senderDisplay, senderId: senderId, fallbackId: fallbackId, spaceType: spaceType
    });

    // FAST-ACK: send immediately to backend (no blocking on images or backend response)
    try {
      sendToBackend_({
        messageText: text,
        files: [], // skip heavy image download for immediate response
        metaIds: {
          spaceName: spaceName,
          threadName: threadName,
          messageName: messageName,
          senderEmail: senderEmail,
          senderDisplay: senderDisplay,
          senderId: senderId,
          fallbackId: fallbackId,
          spaceType: spaceType
        }
      });
    } catch (fastErr) {
      console.error('[ERROR] Fast-ack backend send failed (non-blocking):', fastErr);
    }

    // Immediate reply so Chat never times out
    return chatReply_('Thanks! I\'m logging your update now.');

    // Handle attachments (images from Chat or Drive) — unreachable in fast-ack path
    var atts = p.attachments || p.attachment || p.message?.attachments || p.message?.attachment || [];
    if (!Array.isArray(atts)) atts = [atts];
    console.log('[DEBUG] Found attachments:', atts.length);
    console.log('[DEBUG] Attachments details:', JSON.stringify(atts, null, 2));

    var imgAtts = atts.filter(function(a) {
      var ct = a?.contentType || '';
      var hasDrive = !!a?.driveDataRef?.driveFileId;
      var isImage = hasDrive || ct.startsWith('image/') || ct.includes('image') || ct === 'application/octet-stream';
      console.log('[DEBUG] Attachment filter - contentType:', ct, 'hasDrive:', hasDrive, 'isImage:', isImage);
      return isImage;
    });
    console.log('[DEBUG] Image attachments count:', imgAtts.length);

    // Download all images
    var files = [];
    for (var i = 0; i < imgAtts.length; i++) {
      console.log('[DEBUG] Processing attachment ' + (i + 1) + '/' + imgAtts.length + ':', JSON.stringify(imgAtts[i], null, 2));
      
      try {
        var result = getAttachmentBytes_(imgAtts[i]);
        if (result.bytes) {
          console.log('[DEBUG] Successfully downloaded attachment: ' + result.filename + ', size: ' + result.bytes.length + ' bytes, type: ' + result.mimeType);
          files.push({
            bytes: result.bytes,
            mimeType: result.mimeType || 'application/octet-stream',
            filename: result.filename || 'upload.bin'
          });
        } else {
          console.log('[DEBUG] No bytes returned for attachment ' + (i + 1));
        }
      } catch (attErr) {
        console.error('[ERROR] Failed to download attachment ' + (i + 1) + ':', attErr.toString());
        return chatReply_('⚠️ Couldn\'t send: ' + attErr.toString().slice(0, MAX_SNIPPET));
      }
    }
    console.log('[DEBUG] Total files downloaded:', files.length);

    // Send to Cloud Run backend
    console.log('[DEBUG] Sending to backend...');
    try {
      sendToBackend_({
        messageText: text,
        files: files,
        metaIds: {
          spaceName: spaceName,
          threadName: threadName,
          messageName: messageName,
          senderEmail: senderEmail,
          senderDisplay: senderDisplay,
          senderId: senderId,
          fallbackId: fallbackId,
          spaceType: spaceType
        }
      });
      console.log('[DEBUG] Backend send completed');
    } catch (backendErr) {
      console.error('[ERROR] Backend send failed:', backendErr);
      return chatReply_('⚠️ Backend error: ' + backendErr.toString().slice(0, MAX_SNIPPET));
    }

    // Log to Google Sheets for backup/audit
    console.log('[DEBUG] Logging to sheets...');
    try {
      logUpdate_({ text: text, spaceName: spaceName, threadName: threadName, messageName: messageName, senderEmail: senderEmail, senderDisplay: senderDisplay, spaceType: spaceType, fileCount: files.length });
      console.log('[DEBUG] Sheets logging completed');
    } catch (sheetsErr) {
      console.error('[ERROR] Sheets logging failed:', sheetsErr);
      // Don't fail the whole operation for sheets logging
    }

    // Check if backend provided a formatted response
    console.log('[DEBUG] About to check for backend response...');
    var backendResponse = checkBackendResponse_();
    if (backendResponse) {
      console.log('[DEBUG] ✅ SUCCESS: Using backend-generated response');
      return backendResponse;
    }
    
    // Fallback to local smart reply
    console.log('[DEBUG] ❌ FALLBACK: No backend response found, using local reply');
    var msg = generateSmartReply_(senderName, files.length, text);
    console.log('[DEBUG] Returning local fallback reply:', msg);
    return chatReply_(msg);

  } catch (err) {
    var msg = (err && (err.message || err.stack)) ? String(err.message || err.stack) : String(err);
    var compact = msg.slice(0, MAX_SNIPPET);
    console.error('[Chat→Backend] Error:', msg);
    console.error('[Chat→Backend] Full error object:', err);
    return chatReply_('⚠️ Error processing: ' + compact);
  }
}

function getAttachmentBytes_(attachment) {
  console.log('[DEBUG] getAttachmentBytes_ called with:', JSON.stringify(attachment, null, 2));
  
  // Chat media attachment
  if (attachment?.attachmentDataRef?.resourceName) {
    console.log('[DEBUG] Processing Chat media attachment');
    var resourceName = attachment.attachmentDataRef.resourceName;
    var ct = attachment.contentType || 'application/octet-stream';
    var name = attachment.contentName || 'chat-image';
    console.log('[DEBUG] Resource name:', resourceName, 'Content type:', ct, 'Name:', name);
    
    try {
      var bytes = downloadChatMedia_(resourceName);
      console.log('[DEBUG] Chat media downloaded successfully, size:', bytes ? bytes.length : 0);
      return { bytes: bytes, mimeType: ct, filename: name };
    } catch (chatErr) {
      console.error('[ERROR] Chat media download failed:', chatErr);
      throw chatErr;
    }
  }
  
  // Google Drive file attachment
  if (attachment?.driveDataRef?.driveFileId) {
    console.log('[DEBUG] Processing Drive file attachment');
    var fileId = attachment.driveDataRef.driveFileId;
    console.log('[DEBUG] Drive file ID:', fileId);
    
    try {
      var result = downloadDriveFile_(fileId);
      console.log('[DEBUG] Drive file downloaded successfully, size:', result.bytes ? result.bytes.length : 0);
      return result;
    } catch (driveErr) {
      console.error('[ERROR] Drive file download failed:', driveErr);
      throw driveErr;
    }
  }
  
  console.log('[DEBUG] No recognized attachment type found');
  return { bytes: null, mimeType: null, filename: null };
}

function downloadChatMedia_(resourceName) {
  console.log('[DEBUG] downloadChatMedia_ called with resourceName:', resourceName);
  var url = 'https://chat.googleapis.com/v1/media/' + encodeURIComponent(resourceName) + '?alt=media';
  console.log('[DEBUG] Chat media URL:', url);
  
  try {
    var token = ScriptApp.getOAuthToken();
    console.log('[DEBUG] Got OAuth token, length:', token ? token.length : 0);
    
    var res = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    var code = res.getResponseCode();
    console.log('[DEBUG] Chat media response code:', code);
    
    if (code !== 200) {
      var errorText = res.getContentText();
      console.error('[ERROR] Chat media HTTP error:', code, errorText);
      throw new Error('media.download HTTP ' + code + ': ' + errorText.slice(0, MAX_SNIPPET));
    }
    
    var content = res.getContent();
    console.log('[DEBUG] Chat media content size:', content ? content.length : 0);
    return content;
    
  } catch (fetchErr) {
    console.error('[ERROR] Chat media fetch error:', fetchErr);
    throw fetchErr;
  }
}

function downloadDriveFile_(fileId) {
  console.log('[DEBUG] downloadDriveFile_ called with fileId:', fileId);
  
  try {
    var token = ScriptApp.getOAuthToken();
    console.log('[DEBUG] Got OAuth token for Drive, length:', token ? token.length : 0);
    
    // Get file metadata
    var metaUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?fields=name,mimeType';
    console.log('[DEBUG] Drive metadata URL:', metaUrl);
    
    var metaRes = UrlFetchApp.fetch(metaUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    var metaCode = metaRes.getResponseCode();
    console.log('[DEBUG] Drive metadata response code:', metaCode);
    
    if (metaCode !== 200) {
      var metaError = metaRes.getContentText();
      console.error('[ERROR] Drive metadata error:', metaCode, metaError);
      throw new Error('drive.files.get(meta) HTTP ' + metaCode + ': ' + metaError.slice(0, MAX_SNIPPET));
    }
    
    var meta = JSON.parse(metaRes.getContentText() || '{}');
    var name = meta.name || 'drive-file';
    var mimeType = meta.mimeType || 'application/octet-stream';
    console.log('[DEBUG] Drive file metadata - name:', name, 'mimeType:', mimeType);

    // Download file content
    var mediaUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media';
    console.log('[DEBUG] Drive media URL:', mediaUrl);
    
    var res = UrlFetchApp.fetch(mediaUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    console.log('[DEBUG] Drive media response code:', code);
    
    if (code !== 200) {
      var errorText = res.getContentText();
      console.error('[ERROR] Drive media error:', code, errorText);
      throw new Error('drive.files.get(media) HTTP ' + code + ': ' + errorText.slice(0, MAX_SNIPPET));
    }
    
    var content = res.getContent();
    console.log('[DEBUG] Drive file content size:', content ? content.length : 0);
    return { bytes: content, mimeType: mimeType, filename: name };
    
  } catch (driveErr) {
    console.error('[ERROR] Drive file fetch error:', driveErr);
    throw driveErr;
  }
}

function sendToBackend_(payload) {
  console.log('[DEBUG] sendToBackend_ called with payload keys:', Object.keys(payload));
  
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('OUTBOUND_URL') || '').trim();
  var hdrName = (props.getProperty('OUTBOUND_HEADER_NAME') || 'X-Webhook-Token').trim();
  var token = (props.getProperty('OUTBOUND_TOKEN') || '').trim();

  console.log('[DEBUG] Backend config - URL:', url, 'Header:', hdrName, 'Token length:', token.length);

  if (!url) throw new Error('Missing OUTBOUND_URL in script properties');
  if (!token) throw new Error('Missing OUTBOUND_TOKEN in script properties');

  var hasImages = Array.isArray(payload.files) && payload.files.length > 0;
  console.log('[DEBUG] Has images:', hasImages, 'File count:', hasImages ? payload.files.length : 0);

  var metaObj = {
    source: 'google-chat-bot',
    hasImages: hasImages,
    imageCount: hasImages ? payload.files.length : 0,
    messageText: typeof payload.messageText === 'string' ? payload.messageText : '',
    ts: new Date().toISOString(),
    spaceName: payload.metaIds?.spaceName || '',
    threadName: payload.metaIds?.threadName || '',
    messageName: payload.metaIds?.messageName || '',
    senderEmail: payload.metaIds?.senderEmail || '',
    senderDisplay: payload.metaIds?.senderDisplay || '',
    senderId: payload.metaIds?.senderId || '',
    fallbackId: payload.metaIds?.fallbackId || '',
    spaceType: payload.metaIds?.spaceType || ''
  };
  console.log('[DEBUG] Meta object:', JSON.stringify(metaObj, null, 2));

  // Create multipart form data
  var form = {
    meta: JSON.stringify(metaObj),
    messageText: metaObj.messageText,
    hasImages: String(metaObj.hasImages),
    imageCount: String(metaObj.imageCount),
    ts: metaObj.ts,
    spaceName: metaObj.spaceName,
    threadName: metaObj.threadName,
    messageName: metaObj.messageName,
    senderEmail: metaObj.senderEmail,
    senderDisplay: metaObj.senderDisplay,
    senderId: metaObj.senderId,
    fallbackId: metaObj.fallbackId,
    spaceType: metaObj.spaceType
  };

  // Add image files to form
  if (hasImages) {
    console.log('[DEBUG] Adding files to form...');
    payload.files.forEach(function(f, idx) {
      var key = 'file_' + (idx + 1);
      console.log('[DEBUG] Adding file', key, '- name:', f.filename, 'type:', f.mimeType, 'size:', f.bytes.length);
      form[key] = Utilities.newBlob(
        f.bytes, 
        f.mimeType || 'application/octet-stream', 
        f.filename || ('upload_' + (idx + 1) + '.bin')
      );
    });
  }

  var headers = {};
  headers[hdrName] = token;
  console.log('[DEBUG] Request headers:', JSON.stringify(headers, null, 2));

  try {
    console.log('[DEBUG] Sending request to backend...');
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      payload: form,
      headers: headers,
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var responseText = res.getContentText();
    console.log('[DEBUG] Backend response code:', code);
    console.log('[DEBUG] Backend response text:', responseText);
    
    if (code < 200 || code >= 300) {
      var text = responseText.slice(0, MAX_SNIPPET) || 'No response body';
      throw new Error('Backend webhook error ' + code + ': ' + text);
    }
    
    // Try to parse backend response for Chat formatting
    try {
      var backendData = JSON.parse(responseText);
      console.log('[DEBUG] Parsed backend data:', JSON.stringify(backendData, null, 2));
      
      if (backendData.text || backendData.cardsV2) {
        console.log('[DEBUG] Backend provided Chat response format');
        lastBackendResponse = backendData;
      } else {
        console.log('[DEBUG] Backend response structure:', Object.keys(backendData));
      }
    } catch (parseErr) {
      console.log('[DEBUG] Backend response not JSON or not Chat format:', parseErr);
      console.log('[DEBUG] Raw response text:', responseText.slice(0, 200));
    }
    
    console.log('[DEBUG] Backend request successful');
  } catch (backendErr) {
    console.error('[ERROR] Backend request failed:', backendErr);
    throw backendErr;
  }
}

function chatReply_(text) {
  return {
    hostAppDataAction: {
      chatDataAction: {
        createMessageAction: {
          message: { text: text.slice(0, 9900) }
        }
      }
    }
  };
}

// Send a message into a space (and optional thread) using hostAppDataAction
function sendChatMessage_(spaceName, threadName, text) {
  try {
    var action = {
      hostAppDataAction: {
        chatDataAction: {
          spaceName: spaceName,
          createMessageAction: {
            message: { text: String(text || '').slice(0, 9900) }
          }
        }
      }
    };
    if (threadName) {
      action.hostAppDataAction.chatDataAction.threadName = threadName;
    }
    return action;
  } catch (err) {
    console.error('[ERROR] sendChatMessage_ failed:', err);
    throw err;
  }
}

function generateSmartReply_(senderName, fileCount, messageText) {
  console.log('[DEBUG] Generating LOCAL FALLBACK reply for:', senderName, 'files:', fileCount);
  
  // Make it very obvious this is the local fallback response
  var reply = '🤖 BEEPBEEPBOOP! Local Apps Script fallback response.\n\n';
  reply += 'This means the server response was not detected. ';
  reply += 'Files: ' + fileCount + ', Message length: ' + messageText.length + ' chars.\n\n';
  reply += 'If you see this message, the backend response parsing failed.';
  
  return reply;
}

function checkBackendResponse_() {
  console.log('[DEBUG] Checking for backend response...');
  console.log('[DEBUG] lastBackendResponse value:', lastBackendResponse);
  console.log('[DEBUG] lastBackendResponse type:', typeof lastBackendResponse);
  
  if (lastBackendResponse) {
    console.log('[DEBUG] ✅ Found backend response:', JSON.stringify(lastBackendResponse, null, 2));
    var response = lastBackendResponse;
    lastBackendResponse = null; // Clear it after use
    
    // Convert backend response to Apps Script Chat response format
    if (response.cardsV2) {
      console.log('[DEBUG] Using card response format');
      return {
        cardsV2: response.cardsV2
      };
    } else if (response.text) {
      console.log('[DEBUG] Using text response format:', response.text);
      return chatReply_(response.text);
    } else {
      console.log('[DEBUG] Backend response has no text or cardsV2 property');
      console.log('[DEBUG] Available properties:', Object.keys(response));
    }
  }
  
  console.log('[DEBUG] ❌ No backend response found - will use fallback');
  return null;
}

// Google Sheets logging for audit trail
function logUpdate_(info) {
  console.log('[DEBUG] logUpdate_ called with:', JSON.stringify(info, null, 2));
  
  try {
    var sheet = getSheet_();
    var now = new Date();
    var weekOf = weekOfMonday_(now);
    console.log('[DEBUG] Appending row to sheet...');
    sheet.appendRow([
      now.toISOString(),
      weekOf,
      info.senderDisplay || '',
      info.senderEmail || '',
      info.spaceName || '',
      info.text || '',
      info.fileCount || 0
    ]);
    console.log('[DEBUG] Sheet row appended successfully');
  } catch (sheetErr) {
    console.error('[ERROR] Sheet logging error:', sheetErr);
    throw sheetErr;
  }
}

function getSheet_() {
  console.log('[DEBUG] getSheet_ called');
  
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('UPDATES_SHEET_ID');
  console.log('[DEBUG] Existing sheet ID:', id);
  
  var ss;
  
  if (!id) {
    console.log('[DEBUG] Creating new spreadsheet...');
    ss = SpreadsheetApp.create('DropManager Updates');
    var newId = ss.getId();
    props.setProperty('UPDATES_SHEET_ID', newId);
    console.log('[DEBUG] Created spreadsheet with ID:', newId);
    
    var sheet = ss.getActiveSheet();
    sheet.setName('Updates');
    sheet.getRange(1, 1, 1, 7).setValues([[
      'submittedAt', 'weekOf', 'displayName', 'email', 'space', 'text', 'fileCount'
    ]]);
    sheet.autoResizeColumns(1, 7);
    console.log('[DEBUG] Sheet headers set');
    return sheet;
  }
  
  console.log('[DEBUG] Opening existing spreadsheet...');
  ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName('Updates');
  if (!sheet) {
    console.log('[DEBUG] Creating Updates sheet...');
    sheet = ss.insertSheet('Updates');
  }
  return sheet;
}

function weekOfMonday_(d) {
  var date = new Date(d.getTime());
  var day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

// Chat app lifecycle events
function onAddedToSpace(e) {
  console.log('[DEBUG] onAddedToSpace called with:', JSON.stringify(e, null, 2));
  var sp = e.chat.addedToSpacePayload.space;
  var u = e.chat.user;
  var msg = sp.singleUserBotDm 
    ? 'Thanks for the DM, ' + (u.displayName || 'User') + '!' 
    : 'Thanks for adding me to ' + (sp.displayName || 'this space') + '!';
  console.log('[DEBUG] onAddedToSpace reply:', msg);
  return chatReply_(msg);
}

function onRemovedFromSpace(e) {
  console.log('[DEBUG] onRemovedFromSpace called with:', JSON.stringify(e, null, 2));
  console.info('Bot removed from ' + e.chat.removedFromSpacePayload.space.name);
}

// Helper function to manually trigger OAuth consent
function manualAuth() {
  console.log('[DEBUG] manualAuth called - triggering OAuth consent');
  try {
    // Try to access services that require OAuth
    DriveApp.getRootFolder();
    SpreadsheetApp.create('OAuth Test').getId();
    ScriptApp.getOAuthToken();
    console.log('[DEBUG] OAuth consent completed successfully');
    return 'OAuth consent completed successfully';
  } catch (authErr) {
    console.error('[ERROR] OAuth consent failed:', authErr);
    throw authErr;
  }
}