import type { Request, Response, NextFunction } from 'express'

export function verifyChatToken(req: Request, res: Response, next: NextFunction) {
const configured = process.env.CHAT_VERIFICATION_TOKEN
const received = req.header('X-Goog-Chat-Bot-Token') || req.header('x-goog-chat-bot-token')
if (!configured) return res.status(500).json({ error: 'Server token not configured' })
if (received !== configured) return res.status(401).json({ error: 'Invalid token' })
next()
}
