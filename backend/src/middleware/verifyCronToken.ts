import type { Request, Response, NextFunction } from 'express'

export function verifyCronToken(req: Request, res: Response, next: NextFunction) {
const configured = process.env.CRON_TOKEN
const received = req.header('X-Cron-Token') || req.header('x-cron-token')
if (!configured) return res.status(500).json({ error: 'CRON_TOKEN not configured' })
if (received !== configured) return res.status(401).json({ error: 'Invalid cron token' })
next()
}
