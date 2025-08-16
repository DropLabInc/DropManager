import { Router } from 'express';
import { AgentOrchestrator } from '../agents/orchestrator.js';
import { TaskAgent } from '../agents/taskAgent.js';
import { ProjectAgent } from '../agents/projectAgent.js';

const router = Router();

// Single orchestrator instance for now
const orchestrator = new AgentOrchestrator<string>();
orchestrator.register(new TaskAgent());
orchestrator.register(new ProjectAgent());

router.post('/run', async (req, res) => {
  const { userId = 'unknown', conversationId = 'conv_' + Date.now(), messageText = '' } = req.body || {};
  const context = { userId, conversationId } as any;
  try {
    const result = await orchestrator.handle(messageText, context);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.get('/debug', async (_req, res) => {
  res.json({ ok: true, agents: ['task', 'project'] });
});

export { router as agentsRouter };


