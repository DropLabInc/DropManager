import { Router } from 'express'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 } })

export const inboundRouter = Router()

inboundRouter.post('/webhook', upload.any(), async (req, res) => {
const tokenHeaderName = process.env.INBOUND_HEADER_NAME || 'X-Webhook-Token'
const configuredToken = process.env.INBOUND_TOKEN
const received = (req.headers[tokenHeaderName.toLowerCase()] as string) || ''
if (!configuredToken) return res.status(500).json({ error: 'INBOUND_TOKEN not configured' })
if (received !== configuredToken) return res.status(401).json({ error: 'Invalid token' })

// Extract meta and files from multipart body
const metaRaw = (req.body?.meta as string) || '{}'
let meta: any
try { meta = JSON.parse(metaRaw) } catch { meta = { parseError: true } }

const files = (req.files as Express.Multer.File[] | undefined) || []
const mapped = files.map(f => ({
fieldName: f.fieldname,
originalName: f.originalname,
mimeType: f.mimetype,
size: f.size,
buffer: f.buffer
}))

// Log detailed info about incoming requests
console.log('[INBOUND] Received:', {
  meta: meta,
  fileCount: files.length,
  fileDetails: mapped.map(f => ({ name: f.originalName, type: f.mimeType, size: f.size })),
  timestamp: new Date().toISOString()
})

// TODO: persist to Firestore; for now, just echo counts
return res.status(200).json({ ok: true, meta, files: mapped.map(f => ({ fieldName: f.fieldName, originalName: f.originalName, mimeType: f.mimeType, size: f.size })) })
})
