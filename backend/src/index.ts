import express from 'express'
import morgan from 'morgan'
import dotenv from 'dotenv'
import chatRouter from './routes/chat.js'
import { healthRouter } from './routes/health.js'
import { cronRouter } from './routes/cron.js'
import { adminRouter } from './routes/admin.js'
import { inboundRouter } from './routes/inbound.js'
import { dashboardRouter, setProjectManager } from './routes/dashboard.js'
import { testRouter } from './routes/test.js'
import { createStore } from './store/memory.js'
import { ProjectManager } from './services/projectManager.js'

dotenv.config()

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

const store = createStore()
app.set('store', store)

// Initialize project manager with Gemini NLP
let projectManager: ProjectManager;
try {
  projectManager = new ProjectManager();
  setProjectManager(projectManager);
  console.log('[project-manager] Initialized with Gemini NLP');
} catch (error) {
  console.error('[project-manager] Failed to initialize:', error);
  console.log('[project-manager] Check GEMINI_API_KEY environment variable');
  // Don't exit - allow server to start without Gemini for testing
}

app.use('/chat', chatRouter)
app.use('/healthz', healthRouter)
app.use('/cron', cronRouter)
app.use('/admin', adminRouter)
app.use('/inbound', inboundRouter)
app.use('/dashboard', dashboardRouter)
app.use('/test', testRouter)

const port = Number(process.env.PORT || 8080)
app.listen(port, () => {
	console.log(`[server] listening on :${port}`)
})
