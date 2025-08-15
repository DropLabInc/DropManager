import { Router } from 'express'

export const adminRouter = Router()

adminRouter.get('/health', (_req, res) => {
res.json({ ok: true, role: 'admin' })
})
