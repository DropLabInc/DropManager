// Google Chat  n8n + Sheet logging (text + ALL images)
// Configure Project Settings  Script properties:
//   N8N_WEBHOOK_URL, N8N_HEADER_NAME (default X-Webhook-Token), N8N_TOKEN

const MAX_SNIPPET = 400;

function onMessage(event) {
  try {
    if (!event?.chat) throw new Error('No event.chat');

    const p          = event.chat.messagePayload;
    const senderName = p.space?.type === 'DM' ? 'You' : (event.chat?.user?.displayName || 'User');
    const text       = p.message?.text || p.text || '';

    const spaceName     = p.message?.space?.name || p.space?.name || '';
    const threadName    = p.message?.thread?.name || '';
    const messageName   = p.message?.name || '';
    const senderEmail   = p.message?.sender?.email || event.chat?.user?.email || '';
    const senderDisplay = p.message?.sender?.displayName || event.chat?.user?.displayName || '';
    const spaceType     = p.space?.type || p.message?.space?.type || '';

    let atts = p.attachments || p.attachment || p.message?.attachments || p.message?.attachment || [];
    if (!Array.isArray(atts)) atts = [atts];

    const imgAtts = atts.filter(a => {
      const ct = a?.contentType || '';
      const hasDrive = !!a?.driveDataRef?.driveFileId;
      return hasDrive || ct.startsWith('image/') || ct.includes('image') || ct === 'application/octet-stream';
    });

    const files = [];
    for (const att of imgAtts) {
      const { bytes, mimeType, filename } = getAttachmentBytes_(att);
      if (bytes) files.push({ bytes, mimeType: mimeType || 'application/octet-stream', filename: filename || 'upload.bin' });
    }

    sendToN8nCombined_({
      messageText: text,
      files,
      metaIds: { spaceName, threadName, messageName, senderEmail, senderDisplay, spaceType }
    });

    // Log to Sheet for traceability
    logUpdate_({ text, spaceName, threadName, messageName, senderEmail, senderDisplay, spaceType, fileCount: files.length });

    const msg = files.length
      ? ${senderName}, sent  image and text to n8n.
      : ${senderName}, sent your message to n8n.;
    return chatReply_(msg);

  } catch (err) {
    const msg = (err && (err.message || err.stack)) ? String(err.message || err.stack) : String(err);
    const compact = msg.slice(0, MAX_SNIPPET);
    console.error('[Chatn8n] Error:', msg);
    return chatReply_( Couldnt send to n8n: );
  }
}

function getAttachmentBytes_(attachment) {
  if (attachment?.attachmentDataRef?.resourceName) {
    const resourceName = attachment.attachmentDataRef.resourceName;
    const ct = attachment.contentType || 'application/octet-stream';
    const name = attachment.contentName || 'chat-image';
    const bytes = downloadChatMedia_(resourceName);
    return { bytes, mimeType: ct, filename: name };
  }
  if (attachment?.driveDataRef?.driveFileId) {
    const fileId = attachment.driveDataRef.driveFileId;
    return downloadDriveFile_(fileId);
  }
  return { bytes: null, mimeType: null, filename: null };
}

function downloadChatMedia_(resourceName) {
  const url = https://chat.googleapis.com/v1/media/?alt=media;
  const res = safeFetch_(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  }, 'media.download');
  return res.getContent();
}

function downloadDriveFile_(fileId) {
  const metaUrl = https://www.googleapis.com/drive/v3/files/?fields=name,mimeType;
  const metaRes = safeFetch_(metaUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  }, 'drive.files.get(meta)');
  const meta = JSON.parse(metaRes.getContentText() || '{}');
  const name = meta.name || 'drive-file';
  const mimeType = meta.mimeType || 'application/octet-stream';

  const mediaUrl = https://www.googleapis.com/drive/v3/files/?alt=media;
  const res = safeFetch_(mediaUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  }, 'drive.files.get(media)');

  return { bytes: res.getContent(), mimeType, filename: name };
}

function sendToN8nCombined_(payload) {
  const url      = (PropertiesService.getScriptProperties().getProperty('N8N_WEBHOOK_URL') || '').trim();
  const hdrName  = (PropertiesService.getScriptProperties().getProperty('N8N_HEADER_NAME') || 'X-Webhook-Token').trim();
  const tokenRaw = PropertiesService.getScriptProperties().getProperty('N8N_TOKEN');

  if (!url) throw new Error('Missing N8N_WEBHOOK_URL');
  if (!tokenRaw) throw new Error('Missing N8N_TOKEN');

  const token = tokenRaw.trim();
  const hasImages = Array.isArray(payload.files) && payload.files.length > 0;

  const metaObj = {
    source: 'google-chat-bot',
    hasImages,
    imageCount: hasImages ? payload.files.length : 0,
    messageText: typeof payload.messageText === 'string' ? payload.messageText : '',
    ts: new Date().toISOString(),
    spaceName: payload.metaIds?.spaceName || '',
    threadName: payload.metaIds?.threadName || '',
    messageName: payload.metaIds?.messageName || '',
    senderEmail: payload.metaIds?.senderEmail || '',
    senderDisplay: payload.metaIds?.senderDisplay || '',
    spaceType: payload.metaIds?.spaceType || ''
  };

  const form = {
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
    spaceType: metaObj.spaceType
  };

  if (hasImages) {
    payload.files.forEach((f, idx) => {
      const key = ile_;
      form[key] = Utilities.newBlob(f.bytes, f.mimeType || 'application/octet-stream', f.filename || upload_.bin);
    });
  }

  const headers = {}; headers[hdrName] = token;

  const res = UrlFetchApp.fetch(url, { method: 'post', payload: form, headers, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    const text = (res.getContentText && res.getContentText().slice(0, MAX_SNIPPET)) || '';
    throw new Error(
8n webhook error : );
  }
}

function safeFetch_(url, params, label) {
  const res = UrlFetchApp.fetch(url, params);
  const code = res.getResponseCode();
  if (code !== 200) {
    const snippet = (res.getContentText && res.getContentText().slice(0, MAX_SNIPPET)) || '';
    throw new Error(${label} HTTP : );
  }
  return res;
}

function chatReply_(text) {
  return { hostAppDataAction: { chatDataAction: { createMessageAction: { message: { text: text.slice(0, 9900) } } } } };
}

function logUpdate_(info) {
  const sheet = getSheet_();
  const now = new Date();
  const weekOf = weekOfMonday_(now);
  sheet.appendRow([
    now.toISOString(), weekOf, info.senderDisplay || '', info.senderEmail || '', info.spaceName || '', info.text || '', info.fileCount || 0
  ]);
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('UPDATES_SHEET_ID');
  let ss;
  if (!id) {
    ss = SpreadsheetApp.create('DropManager Updates');
    props.setProperty('UPDATES_SHEET_ID', ss.getId());
    const sheet = ss.getActiveSheet();
    sheet.setName('Updates');
    sheet.getRange(1, 1, 1, 7).setValues([[ 'submittedAt', 'weekOf', 'displayName', 'email', 'space', 'text', 'fileCount' ]]);
    sheet.autoResizeColumns(1, 7);
    return sheet;
  }
  ss = SpreadsheetApp.openById(id);
  return ss.getSheetByName('Updates') || ss.insertSheet('Updates');
}

function weekOfMonday_(d) {
  const date = new Date(d.getTime());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date.toISOString().slice(0,10);
}
