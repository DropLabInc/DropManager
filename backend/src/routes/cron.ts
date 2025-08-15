import { Router } from 'express'
import type { Request, Response } from 'express'
import { verifyCronToken } from '../middleware/verifyCronToken.js'

export const cronRouter = Router()

cronRouter.post('/weekly-reminders', verifyCronToken, async (_req: Request, res: Response) => {
res.status(200).json({ ok: true, triggered: 'weekly-reminders' })
})

cronRouter.post('/escalations', verifyCronToken, async (_req: Request, res: Response) => {
res.status(200).json({ ok: true, triggered: 'escalations' })
})
