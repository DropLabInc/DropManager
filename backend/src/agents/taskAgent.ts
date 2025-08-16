import type { Agent, AgentContext, AgentResult } from './types.js';
import { ExtractedTaskLike, KnowledgeGap, Question } from './types.js';
import { GeminiNLP } from '../services/geminiNLP.js';

export class TaskAgent implements Agent<string> {
  public name = 'task' as const;
  private nlp = new GeminiNLP();

  canHandle(input: string): boolean {
    return typeof input === 'string' && input.trim().length > 0;
  }

  async handle(messageText: string, context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    logs.push('[task] extracting tasks');

    const tasks = await this.nlp.extractTasks(messageText, context.userId);
    const minimal = tasks.map<ExtractedTaskLike>(t => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      tags: t.tags,
    }));

    const gaps = this.detectGaps(minimal);
    const questions = this.generateQuestions(gaps);

    return {
      outbound: [
        {
          id: '',
          fromAgent: 'task',
          toAgent: 'project',
          type: 'REQUEST',
          payload: { tasks: minimal },
          priority: 'MEDIUM',
          context,
          timestamp: '',
        },
        ...(questions.length > 0
          ? ([{
                id: '',
                fromAgent: 'task' as const,
                toAgent: 'question' as const,
                type: 'QUERY' as const,
                payload: { questions },
                priority: 'LOW' as const,
                context,
                timestamp: '',
              }] as any)
          : ([] as any)),
      ],
      logs,
    };
  }

  private detectGaps(tasks: ExtractedTaskLike[]): KnowledgeGap[] {
    const gaps: KnowledgeGap[] = [];
    for (const t of tasks) {
      if (!t.priority) gaps.push({ code: 'missing_priority', description: `Task '${t.title}' missing priority`, field: 'priority', severity: 'low' });
      if (!t.status) gaps.push({ code: 'missing_status', description: `Task '${t.title}' missing status`, field: 'status', severity: 'low' });
      // Optional: encourage due date
      if (!t.dueDate) gaps.push({ code: 'missing_due', description: `Task '${t.title}' missing due date`, field: 'dueDate', severity: 'low' });
    }
    return gaps;
  }

  private generateQuestions(gaps: KnowledgeGap[]): Question[] {
    const byField = new Map<string, KnowledgeGap[]>();
    for (const g of gaps) {
      const key = g.field || g.code;
      if (!byField.has(key)) byField.set(key, []);
      byField.get(key)!.push(g);
    }
    const out: Question[] = [];
    for (const [field, gs] of byField.entries()) {
      const titles = gs.map(g => g.description).join('; ');
      out.push({ id: `${field}-${out.length + 1}`, text: `Could you provide ${field} details? (${titles})`, field, required: false });
    }
    return out;
  }
}


