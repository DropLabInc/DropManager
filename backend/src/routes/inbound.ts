import { Router } from 'express'
import multer from 'multer'
import { ProjectManager } from '../services/projectManager.js'
import { getProjectManager } from './dashboard.js'
import { ChatMessenger } from '../services/chatMessenger.js'
import type { ProcessUpdateRequest } from '../types/index.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 } })
// Lazily resolve the shared ProjectManager on each request to avoid capturing
// a separate instance during module load order.
let fallbackPM: ProjectManager | undefined
function resolveProjectManager(): ProjectManager {
  const shared = getProjectManager?.()
  if (shared) return shared
  if (!fallbackPM) fallbackPM = new ProjectManager()
  return fallbackPM
}
const chatMessenger = new ChatMessenger()

export const inboundRouter = Router()

inboundRouter.post('/webhook', upload.any(), async (req, res) => {
  const projectManager = resolveProjectManager()
  console.log('[INBOUND] Using ProjectManager instance:', (projectManager as any)?.instanceId)
  const tokenHeaderName = process.env.INBOUND_HEADER_NAME || 'X-Webhook-Token'
  const configuredToken = process.env.INBOUND_TOKEN
  const received = (req.headers[tokenHeaderName.toLowerCase()] as string) || ''
  console.log('[INBOUND] Auth check:', { tokenHeaderName, hasConfigured: !!configuredToken, receivedLen: received.length })
  
  if (!configuredToken) return res.status(500).json({ error: 'INBOUND_TOKEN not configured' })
  if (received !== configuredToken) return res.status(401).json({ error: 'Invalid token' })

  try {
    // Extract meta and files from multipart body
    const metaRaw = (req.body?.meta as string) || '{}'
    let meta: any
    try { meta = JSON.parse(metaRaw) } catch { meta = { parseError: true } }

    // Handle Apps Script metaIds structure
    const metaIds = req.body?.metaIds || {}

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
      bodyKeys: Object.keys(req.body || {}),
      meta: meta,
      metaIds: metaIds,
      fileCount: files.length,
      fileDetails: mapped.map(f => ({ name: f.originalName, type: f.mimeType, size: f.size })),
      timestamp: new Date().toISOString()
    })

    // Extract required data for project management - handle both meta and metaIds
    const messageText = (req.body?.messageText as string) || meta.messageText || ''
    const senderEmail = (req.body?.senderEmail as string) || meta.senderEmail || metaIds.senderEmail || ''
    const senderDisplay = (req.body?.senderDisplay as string) || meta.senderDisplay || metaIds.senderDisplay || 'Unknown User'
    const weekOf = getWeekOfMonday(new Date())

    // Create employee ID from email (simple hash for MVP)
    const employeeId = senderEmail ? createEmployeeId(senderEmail) : 'unknown'

    // Debug logging
    console.log('[INBOUND] Extracted data:', {
      messageText: messageText,
      messageTextLength: messageText.length,
      senderEmail: senderEmail,
      senderDisplay: senderDisplay,
      employeeId: employeeId,
      hasMessageText: !!messageText,
      hasSenderEmail: !!senderEmail,
      willProcess: !!(messageText && senderEmail)
    })

    if (messageText && senderEmail) {
      // Build request for ProjectManager with Gemini NLP
      const hasImages = Boolean((meta.hasImages as boolean) ?? (mapped.length > 0))
      const imageCount = Number((meta.imageCount as number) ?? mapped.length)
      const chatMetadata = {
        spaceName: (req.body?.spaceName as string) || (meta.spaceName as string) || (metaIds.spaceName as string) || '',
        threadName: (req.body?.threadName as string) || (meta.threadName as string) || (metaIds.threadName as string) || '',
        messageName: (req.body?.messageName as string) || (meta.messageName as string) || (metaIds.messageName as string) || '',
        spaceType: (req.body?.spaceType as string) || (meta.spaceType as string) || (metaIds.spaceType as string) || ''
      }

      const processReq: ProcessUpdateRequest = {
        messageText,
        employeeId: employeeId,
        employeeEmail: senderEmail,
        employeeDisplayName: senderDisplay,
        weekOf,
        hasImages,
        imageCount,
        chatMetadata
      }

      console.log('[INBOUND] Processing update via ProjectManager...')
      const pmResponse = await projectManager.processUpdate(processReq)
      console.log('[INBOUND] ProjectManager response:', {
        success: pmResponse.success,
        extractedTasks: pmResponse.extractedTasks.length,
        assignedProjects: pmResponse.assignedProjects.length
      })

      const replyText = pmResponse.message || `Thanks, ${senderDisplay}! Your update was processed.`
      const chatResponse = chatMessenger.createWebhookResponse(replyText)

      return res.status(200).json({
        ...chatResponse,
        _metadata: {
          ok: true,
          processed: true,
          messageText,
          senderEmail,
          senderDisplay,
          hasImages,
          imageCount,
          pm: {
            success: pmResponse.success,
            tasks: pmResponse.extractedTasks.length,
            projects: pmResponse.assignedProjects.length
          }
        }
      })
    } else {
      // Fallback for messages without proper text/sender info
      console.log('[INBOUND] Using fallback response - missing data:', {
        messageText: messageText,
        senderEmail: senderEmail,
        reason: !messageText ? 'No messageText' : 'No senderEmail'
      })
      
      return res.status(200).json({ 
        ok: true, 
        processed: false,
        reason: 'Missing messageText or senderEmail',
        debug: {
          messageText: messageText,
          senderEmail: senderEmail,
          messageTextLength: messageText.length,
          hasMessageText: !!messageText,
          hasSenderEmail: !!senderEmail
        },
        meta, 
        files: mapped.map(f => ({ 
          fieldName: f.fieldName, 
          originalName: f.originalName, 
          mimeType: f.mimeType, 
          size: f.size 
        })) 
      })
    }

  } catch (error) {
    console.error('[INBOUND] Error processing webhook:', error)
    return res.status(500).json({ 
      ok: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Helper functions
function getWeekOfMonday(date: Date): string {
  const d = new Date(date.getTime())
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function createEmployeeId(email: string): string {
  // Simple hash function for MVP (in production, use proper UUID or database ID)
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return 'emp_' + Math.abs(hash).toString(36)
}
