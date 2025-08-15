import { Router } from 'express'
import type { Request, Response } from 'express'
import { verifyChatToken } from '../utils/verifyChatToken.js'

const router = Router()

router.post('/events', verifyChatToken, async (req: Request, res: Response) => {
const event = req.body
const store: any = req.app.get('store')
const now = new Date().toISOString()
const record = { id: `${Date.now()}`, receivedAt: now, event }
store.updates.push(record)
res.status(200).json({ text: 'Thanks! Update received.' })
})

export default router
