import type { Agent, AgentContext, AgentResult } from './types.js';
import { ProjectManager } from '../services/projectManager.js';

export class ProjectAgent implements Agent<{ tasks: any[] }> {
  public name = 'project' as const;
  private pm = new ProjectManager();

  canHandle(input: { tasks: any[] }): boolean {
    return Boolean(input && Array.isArray(input.tasks) && input.tasks.length > 0);
  }

  async handle(input: { tasks: any[] }, _context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const assigned: Array<{ title: string; projectId: string }> = [];

    for (const t of input.tasks) {
      // Create minimal task shell to reuse assignment logic
      const nowIso = new Date().toISOString();
      const task = {
        id: 'agent_' + Math.random().toString(36).slice(2, 10),
        employeeId: 'agent',
        title: t.title,
        description: t.description || '',
        status: (t.status as any) || 'in-progress',
        priority: (t.priority as any) || 'medium',
        tags: t.tags || [],
        createdAt: nowIso,
        updatedAt: nowIso,
      } as any;

      const projectId = await (this.pm as any).assignTaskToProject(task);
      if (projectId) assigned.push({ title: t.title, projectId });
    }

    logs.push(`[project] assigned ${assigned.length} tasks to projects`);
    return { outbound: [], logs };
  }
}


