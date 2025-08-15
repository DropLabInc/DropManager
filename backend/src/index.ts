import express from 'express'
import morgan from 'morgan'
import dotenv from 'dotenv'
import chatRouter from './routes/chat.js'
import { healthRouter } from './routes/health.js'
import { cronRouter } from './routes/cron.js'
import { adminRouter } from './routes/admin.js'
import { inboundRouter } from './routes/inbound.js'
import { createStore } from './store/memory.js'

dotenv.config()

const app = express()
app.use(express.json())
app.use(morgan('dev'))

const store = createStore()
app.set('store', store)

app.use('/chat', chatRouter)
app.use('/healthz', healthRouter)
app.use('/cron', cronRouter)
app.use('/admin', adminRouter)
app.use('/inbound', inboundRouter)

const port = Number(process.env.PORT || 8080)
app.listen(port, () => {
	console.log(`[server] listening on :${port}`)
})
