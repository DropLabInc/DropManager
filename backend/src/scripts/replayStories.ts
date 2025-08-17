/*
  Replay Stories Markdown files as inbound webhook messages for local testing.

  Usage (after build):
    INBOUND_TOKEN=your-token npm run replay:md -- --limit 5 --pattern Sergio

  Optional env:
    STORIES_DIR   Absolute or relative path to Stories directory (default: ../Stories)
    INBOUND_URL   Target URL (default: http://localhost:8080/inbound/webhook)
    HEADER_NAME   Header name for token (default: X-Webhook-Token or env INBOUND_HEADER_NAME)
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

type ReplayOptions = {
  storiesDir: string;
  inboundUrl: string;
  headerName: string;
  token: string;
  limit: number;
  delayMs: number;
  pattern?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options: ReplayOptions = {
    storiesDir: path.resolve(process.env.STORIES_DIR || path.join(process.cwd(), '..', 'Stories')),
    inboundUrl: process.env.INBOUND_URL || 'http://localhost:8080/inbound/webhook',
    headerName: process.env.HEADER_NAME || process.env.INBOUND_HEADER_NAME || 'X-Webhook-Token',
    token: process.env.INBOUND_TOKEN || '',
    limit: Number(args['limit'] || 20),
    delayMs: Number(args['delay'] || 250),
    pattern: args['pattern'],
  };

  if (!options.token) {
    console.error('[replay] INBOUND_TOKEN env var is required');
    process.exit(1);
  }

  console.log('[replay] Options:', options);
  const mdFiles = await collectMarkdownFiles(options.storiesDir, options.pattern);
  console.log(`[replay] Found ${mdFiles.length} markdown files`);

  let count = 0;
  for (const file of mdFiles) {
    if (count >= options.limit) break;
    const text = await fs.readFile(file, 'utf8');
    const meta = deriveMetaFromPath(file);
    const ok = await sendInbound(text, meta, options);
    console.log(`[replay] ${ok ? 'OK' : 'FAIL'} → ${path.basename(file)}`);
    count++;
    if (options.delayMs > 0) await sleep(options.delayMs);
  }

  console.log('[replay] Done');
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function collectMarkdownFiles(root: string, pattern?: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const isMd = entry.name.toLowerCase().endsWith('.md');
        const matches = !pattern || full.toLowerCase().includes(pattern.toLowerCase());
        if (isMd && matches) files.push(full);
      }
    }
  }
  await walk(root);
  return files;
}

function deriveMetaFromPath(filePath: string) {
  // Expect structure: Stories/Data/<Person>/Check-ins <hash>/<file>.md
  const parts = filePath.split(path.sep);
  const idx = parts.findIndex((p) => p.toLowerCase() === 'data');
  const person = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : 'Unknown';
  const parent = parts[parts.length - 2] || '';
  const file = path.basename(filePath, '.md');
  const senderDisplay = person;
  const senderEmail = `${person.replace(/\s+/g, '.').toLowerCase()}@example.local`;
  return {
    spaceName: parent,
    threadName: file,
    messageName: file,
    senderEmail,
    senderDisplay,
    spaceType: 'SPACE',
  };
}

async function sendInbound(messageText: string, metaIds: any, options: ReplayOptions): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    headers[options.headerName] = options.token;

    const form = new URLSearchParams();
    form.set('messageText', messageText);
    form.set('senderEmail', metaIds.senderEmail);
    form.set('senderDisplay', metaIds.senderDisplay);
    form.set('spaceName', metaIds.spaceName);
    form.set('threadName', metaIds.threadName);
    form.set('messageName', metaIds.messageName);
    form.set('spaceType', metaIds.spaceType);

    const res = await fetch(options.inboundUrl, {
      method: 'POST',
      headers,
      body: form as any,
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[replay] inbound error', res.status, text.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[replay] send failed', e);
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Execute if run directly
try {
  const thisFile = fileURLToPath(import.meta.url);
  const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
  if (thisFile === invokedFile) {
    // Executed directly via `node dist/scripts/replayStories.js`
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    main();
  }
} catch {
  // Fallback: just run
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}


