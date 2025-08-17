import { Router } from 'express'
import type { Request, Response } from 'express'
import { verifyCronToken } from '../middleware/verifyCronToken.js'
import { getProjectManager } from './dashboard.js'
import { ChatMessenger } from '../services/chatMessenger.js'

export const cronRouter = Router()

cronRouter.post('/weekly-reminders', verifyCronToken, async (_req: Request, res: Response) => {
  const pm = getProjectManager?.()
  const messenger = new ChatMessenger()
  let sent = 0
  let failed = 0
  try {
    // Pull all updates, newest first
    const allUpdates: any[] = (pm as any)?.getUpdates?.() || []
    allUpdates.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const seenSpaces = new Set<string>()
    for (const u of allUpdates) {
      const spaceName = u?.chatMetadata?.spaceName
      if (!spaceName || seenSpaces.has(spaceName)) continue
      seenSpaces.add(spaceName)
      const ok = await messenger.sendProactiveMessage({
        spaceName,
        threadName: u?.chatMetadata?.threadName,
        text: `Reminder: please share your concise update for this week. Thanks!`
      })
      ok ? sent++ : failed++
    }
  } catch (e) {
    console.error('[CRON] weekly-reminders error:', e)
  }
  res.status(200).json({ ok: true, triggered: 'weekly-reminders', sent, failed })
})

// Direct send endpoint for testing proactive messages
cronRouter.post('/send', verifyCronToken, async (req: Request, res: Response) => {
  const { spaceName, threadName, text } = req.body || {}
  if (!spaceName || !text) {
    return res.status(400).json({ ok: false, error: 'spaceName and text are required' })
  }
  const messenger = new ChatMessenger()
  const ok = await messenger.sendProactiveMessage({ spaceName, threadName, text })
  res.status(ok ? 200 : 500).json({ ok })
})

cronRouter.post('/escalations', verifyCronToken, async (_req: Request, res: Response) => {
res.status(200).json({ ok: true, triggered: 'escalations' })
})
