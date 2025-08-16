// Minimal UUID v4 generator to avoid external typings
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type { Agent, AgentContext, AgentMessage, AgentResult } from './types.js';

export class AgentOrchestrator<TInput = any> implements Agent<TInput> {
  public name = 'orchestrator' as const;

  private agents: Agent[] = [];

  register(agent: Agent) {
    this.agents.push(agent);
  }

  canHandle(_input: TInput): boolean {
    return true; // Entry point
  }

  async handle(input: TInput, context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const fanout: Promise<AgentResult>[] = [];

    for (const agent of this.agents) {
      try {
        if (agent.canHandle(input, context)) {
          logs.push(`[orchestrator] dispatch → ${agent.name}`);
          fanout.push(agent.handle(input, context));
        }
      } catch (e) {
        logs.push(`[orchestrator] error deciding for ${agent.name}: ${(e as Error).message}`);
      }
    }

    const results = await Promise.all(fanout);
    const outbound: AgentMessage[] = results.flatMap(r => r.outbound || []);
    results.forEach(r => r.logs?.forEach(l => logs.push(l)));

    // Attach message IDs and timestamps if missing
    outbound.forEach(m => {
      (m as any).id = m.id || uuidv4();
      (m as any).timestamp = m.timestamp || new Date().toISOString();
    });

    return { outbound, logs };
  }
}


