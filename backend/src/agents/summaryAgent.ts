import { AgentType } from './types.js';
import { GeminiNLP } from '../services/geminiNLP.js';
import { ProjectManager } from '../services/projectManager.js';
import { WeeklyUpdate, Project, Employee, Task } from '../types/index.js';

export interface SummaryRequest {
  type: 'project_status' | 'team_performance' | 'weekly_highlights' | 'risk_alerts' | 'executive_brief';
  timeframe?: 'day' | 'week' | 'month';
  projectId?: string;
  employeeId?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface GeneratedSummary {
  type: string;
  title: string;
  content: string;
  keyMetrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
    context?: string;
  }>;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  confidence: number;
  generatedAt: string;
}

export class SummaryAgent {
  public readonly id: string = 'summary-agent';
  public readonly type: AgentType = 'reporting';
  public readonly capabilities: string[] = [
    'project_status_summaries',
    'team_performance_analysis', 
    'weekly_highlights_generation',
    'risk_identification',
    'executive_briefings',
    'metric_extraction',
    'trend_analysis'
  ];

  private gemini: GeminiNLP;
  private projectManager: ProjectManager;

  constructor(projectManager: ProjectManager) {
    this.gemini = new GeminiNLP();
    this.projectManager = projectManager;
  }

  async generateSummary(request: SummaryRequest): Promise<GeneratedSummary> {
    console.log(`[SUMMARY_AGENT] Generating ${request.type} summary...`);

    const data = await this.gatherRelevantData(request);
    const prompt = this.buildSummaryPrompt(request, data);
    
    try {
      const geminiResponse = await this.gemini.generateText(prompt);
      const summary = this.parseSummaryResponse(geminiResponse, request);
      
      console.log(`[SUMMARY_AGENT] Generated summary with ${summary.confidence}% confidence`);
      return summary;
    } catch (error) {
      console.error('[SUMMARY_AGENT] Error generating summary:', error);
      throw new Error(`Summary generation failed: ${error}`);
    }
  }

  private async gatherRelevantData(request: SummaryRequest) {
    const timeframe = request.timeframe || 'week';
    const cutoffDate = this.getTimeframeCutoff(timeframe);

    // Get relevant updates
    let updates = this.projectManager.getUpdates()
      .filter(u => new Date(u.createdAt) >= cutoffDate);

    // Filter by specific criteria
    if (request.projectId) {
      updates = updates.filter(u => u.projects.includes(request.projectId!));
    }
    if (request.employeeId) {
      updates = updates.filter(u => u.employeeId === request.employeeId);
    }

    // Get related entities
    const projects = this.projectManager.getProjects();
    const employees = this.projectManager.getEmployees();
    const tasks = this.projectManager.getTasks();

    // Calculate metrics
    const metrics = this.calculateMetrics(updates, Array.from(projects.values()), Array.from(employees.values()), Array.from(tasks.values()), request);

    return {
      updates,
      projects: Array.from(projects.values()),
      employees: Array.from(employees.values()),
      tasks: Array.from(tasks.values()),
      metrics,
      timeframe,
      cutoffDate
    };
  }

  private calculateMetrics(
    updates: WeeklyUpdate[], 
    projects: Project[], 
    employees: Employee[], 
    tasks: Task[],
    request: SummaryRequest
  ) {
    const totalUpdates = updates.length;
    const uniqueEmployees = new Set(updates.map(u => u.employeeId)).size;
    const activeProjects = new Set(updates.flatMap(u => u.projects)).size;
    
    // Sentiment analysis
    const sentimentCounts = updates.reduce((acc, u) => {
      const sentiment = u.sentiment || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Task completion metrics
    const allTasks = tasks;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const blockedTasks = allTasks.filter(t => t.status === 'blocked').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in-progress').length;

    // Project status distribution
    const allProjects = projects;
    const projectStatusCounts = allProjects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUpdates,
      uniqueEmployees,
      activeProjects,
      sentimentCounts,
      taskMetrics: {
        total: allTasks.length,
        completed: completedTasks,
        blocked: blockedTasks,
        inProgress: inProgressTasks,
        completionRate: allTasks.length > 0 ? (completedTasks / allTasks.length * 100) : 0
      },
      projectStatusCounts,
      averageUpdateLength: totalUpdates > 0 ? 
        updates.reduce((sum, u) => sum + u.messageText.length, 0) / totalUpdates : 0
    };
  }

  private buildSummaryPrompt(request: SummaryRequest, data: any): string {
    const { updates, metrics, timeframe } = data;
    
    let prompt = `You are an AI project management analyst generating a ${request.type} summary for executive review. 

ANALYSIS CONTEXT:
- Timeframe: ${timeframe}
- Total Updates: ${metrics.totalUpdates}
- Active Employees: ${metrics.uniqueEmployees}  
- Active Projects: ${metrics.activeProjects}
- Task Completion Rate: ${metrics.taskMetrics.completionRate.toFixed(1)}%

SENTIMENT DISTRIBUTION:
${Object.entries(metrics.sentimentCounts).map(([sentiment, count]) => 
  `- ${sentiment}: ${count} updates (${((count as number) / metrics.totalUpdates * 100).toFixed(1)}%)`
).join('\n')}

PROJECT STATUS:
${Object.entries(metrics.projectStatusCounts).map(([status, count]) => 
  `- ${status}: ${count} projects`
).join('\n')}

RECENT UPDATES SAMPLE:
${updates.slice(0, 10).map((u: WeeklyUpdate, i: number) => 
  `${i+1}. [${u.employeeId}] ${u.messageText.slice(0, 150)}...`
).join('\n')}

`;

    // Add specific instructions based on summary type
    switch (request.type) {
      case 'project_status':
        prompt += `Generate a PROJECT STATUS summary focusing on:
- Overall project health and progress
- Key milestones achieved
- Potential risks and blockers
- Resource allocation effectiveness
- Next steps and upcoming deadlines`;
        break;
        
      case 'team_performance':
        prompt += `Generate a TEAM PERFORMANCE summary focusing on:
- Individual contributor highlights
- Team collaboration patterns
- Productivity trends and insights
- Skill development and growth areas
- Communication effectiveness`;
        break;
        
      case 'weekly_highlights':
        prompt += `Generate a WEEKLY HIGHLIGHTS summary focusing on:
- Major accomplishments and wins
- Breakthrough moments and innovations
- Cross-team collaboration successes
- Problem-solving achievements
- Notable technical progress`;
        break;
        
      case 'risk_alerts':
        prompt += `Generate a RISK ALERTS summary focusing on:
- Identified project risks and dependencies
- Resource constraints and bottlenecks
- Timeline concerns and delays
- Technical challenges requiring attention
- Communication gaps or unclear requirements`;
        break;
        
      case 'executive_brief':
        prompt += `Generate an EXECUTIVE BRIEF summary focusing on:
- High-level strategic progress
- Business impact and value delivery
- Key decisions needed from leadership
- Resource requirements and budget implications
- Competitive advantages and market positioning`;
        break;
    }

    prompt += `

RESPONSE FORMAT (JSON):
{
  "title": "Concise, descriptive title",
  "content": "2-3 paragraph executive summary",
  "keyMetrics": [
    {"label": "Metric name", "value": "Metric value", "trend": "up/down/stable", "context": "Brief explanation"}
  ],
  "highlights": ["Key positive developments", "Major achievements"],
  "concerns": ["Areas requiring attention", "Potential risks"],
  "recommendations": ["Actionable next steps", "Strategic suggestions"],
  "confidence": 85
}

REQUIREMENTS:
- Keep content concise but comprehensive
- Use data-driven insights from the provided metrics
- Highlight actionable items for management
- Include specific examples from recent updates
- Maintain professional, analytical tone
- Confidence score should reflect data quality and completeness`;

    return prompt;
  }

  private parseSummaryResponse(response: string, request: SummaryRequest): GeneratedSummary {
    try {
      // Clean response (remove markdown code blocks if present)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleaned);
      
      return {
        type: request.type,
        title: parsed.title || `${request.type} Summary`,
        content: parsed.content || 'Summary content not available',
        keyMetrics: parsed.keyMetrics || [],
        highlights: parsed.highlights || [],
        concerns: parsed.concerns || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 70,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[SUMMARY_AGENT] Error parsing response:', error);
      
      // Fallback summary
      return {
        type: request.type,
        title: `${request.type} Summary`,
        content: response.slice(0, 500),
        keyMetrics: [],
        highlights: [],
        concerns: ['Unable to parse structured summary'],
        recommendations: ['Review data quality and try again'],
        confidence: 30,
        generatedAt: new Date().toISOString()
      };
    }
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Public API methods for direct usage
  async generateProjectStatusSummary(projectId?: string): Promise<GeneratedSummary> {
    return this.generateSummary({
      type: 'project_status',
      timeframe: 'week',
      projectId
    });
  }

  async generateTeamPerformanceSummary(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<GeneratedSummary> {
    return this.generateSummary({
      type: 'team_performance',
      timeframe
    });
  }

  async generateWeeklyHighlights(): Promise<GeneratedSummary> {
    return this.generateSummary({
      type: 'weekly_highlights',
      timeframe: 'week'
    });
  }

  async generateRiskAlerts(): Promise<GeneratedSummary> {
    return this.generateSummary({
      type: 'risk_alerts',
      timeframe: 'week'
    });
  }

  async generateExecutiveBrief(): Promise<GeneratedSummary> {
    return this.generateSummary({
      type: 'executive_brief',
      timeframe: 'month'
    });
  }
}
