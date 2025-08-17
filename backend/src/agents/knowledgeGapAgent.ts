import { AgentType } from './types.js';
import { GeminiNLP } from '../services/geminiNLP.js';
import { ProjectManager } from '../services/projectManager.js';
import { WeeklyUpdate, Project, Employee, Task } from '../types/index.js';

export interface KnowledgeGap {
  id: string;
  type: 'missing_dependency' | 'unclear_timeline' | 'resource_constraint' | 'technical_risk' | 'communication_gap' | 'scope_ambiguity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedProjects: string[];
  affectedEmployees: string[];
  evidence: string[];
  impact: string;
  confidence: number;
}

export interface GeneratedQuestion {
  id: string;
  targetEmployeeId: string;
  targetEmployeeName: string;
  gapId: string;
  gapType: string;
  question: string;
  context: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expectedAnswerType: 'timeline' | 'resource' | 'technical' | 'dependency' | 'status' | 'clarification';
  followUpQuestions: string[];
  confidence: number;
  generatedAt: string;
}

export interface GapAnalysisRequest {
  scope?: 'all' | 'project' | 'employee';
  projectId?: string;
  employeeId?: string;
  timeframe?: 'day' | 'week' | 'month';
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

export class KnowledgeGapAgent {
  public readonly id: string = 'knowledge-gap-agent';
  public readonly type: AgentType = 'analysis';
  public readonly capabilities: string[] = [
    'gap_identification',
    'dependency_analysis',
    'risk_detection',
    'question_generation',
    'communication_analysis',
    'scope_validation',
    'timeline_verification'
  ];

  private gemini: GeminiNLP;
  private projectManager: ProjectManager;

  constructor(projectManager: ProjectManager) {
    this.gemini = new GeminiNLP();
    this.projectManager = projectManager;
  }



  async analyzeKnowledgeGaps(request: GapAnalysisRequest = {}) {
    console.log('[KNOWLEDGE_GAP_AGENT] Starting gap analysis...');

    const data = await this.gatherAnalysisData(request);
    const gaps = await this.identifyKnowledgeGaps(data, request);
    const questions = await this.generateQuestions(gaps, data);

    console.log(`[KNOWLEDGE_GAP_AGENT] Found ${gaps.length} gaps, generated ${questions.length} questions`);

    return {
      gaps,
      questions,
      summary: {
        totalGaps: gaps.length,
        criticalGaps: gaps.filter(g => g.severity === 'critical').length,
        highPriorityGaps: gaps.filter(g => g.severity === 'high').length,
        questionsGenerated: questions.length,
        urgentQuestions: questions.filter(q => q.priority === 'urgent').length,
        analyzedAt: new Date().toISOString()
      }
    };
  }

  private async gatherAnalysisData(request: GapAnalysisRequest) {
    const timeframe = request.timeframe || 'week';
    const cutoffDate = this.getTimeframeCutoff(timeframe);

    let updates = this.projectManager.getUpdates()
      .filter(u => new Date(u.createdAt) >= cutoffDate);

    // Apply filters
    if (request.projectId) {
      updates = updates.filter(u => u.projects.includes(request.projectId!));
    }
    if (request.employeeId) {
      updates = updates.filter(u => u.employeeId === request.employeeId);
    }

    const projects = this.projectManager.getProjects();
    const employees = this.projectManager.getEmployees();
    const tasks = this.projectManager.getTasks();

    // Build relationship maps for analysis
    const projectEmployeeMap = this.buildProjectEmployeeMap(updates, Array.from(projects.values()));
    const employeeProjectMap = this.buildEmployeeProjectMap(updates);
    const projectDependencies = this.inferProjectDependencies(updates, Array.from(projects.values()));

    return {
      updates,
      projects: Array.from(projects.values()),
      employees: Array.from(employees.values()),
      tasks: Array.from(tasks.values()),
      projectEmployeeMap,
      employeeProjectMap,
      projectDependencies,
      timeframe,
      cutoffDate
    };
  }

  private async identifyKnowledgeGaps(data: any, request: GapAnalysisRequest): Promise<KnowledgeGap[]> {
    const gaps: KnowledgeGap[] = [];

    // Use Gemini to analyze patterns and identify gaps
    const analysisPrompt = this.buildGapAnalysisPrompt(data);
    
    try {
      const geminiResponse = await this.gemini.generateText(analysisPrompt);
      const aiGaps = this.parseGapAnalysisResponse(geminiResponse);
      gaps.push(...aiGaps);
    } catch (error) {
      console.error('[KNOWLEDGE_GAP_AGENT] Error in AI gap analysis:', error);
    }

    // Add rule-based gap detection as fallback/supplement
    const ruleBasedGaps = this.detectRuleBasedGaps(data);
    gaps.push(...ruleBasedGaps);

    // Filter by minimum severity if specified
    const minSeverity = request.minSeverity || 'low';
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const filteredGaps = gaps.filter(gap => 
      severityOrder[gap.severity] >= severityOrder[minSeverity]
    );

    // Remove duplicates and merge similar gaps
    return this.deduplicateGaps(filteredGaps);
  }

  private buildGapAnalysisPrompt(data: any): string {
    const { updates, projects, tasks, projectEmployeeMap } = data;

    return `You are an AI project management analyst identifying knowledge gaps and missing information that could impact project success.

ANALYSIS DATA:
- Recent Updates: ${updates.length}
- Active Projects: ${projects.length}
- Total Tasks: ${tasks.length}
- Employee-Project Assignments: ${Object.keys(projectEmployeeMap).length}

PROJECT OVERVIEW:
${projects.slice(0, 5).map((p: Project) => 
  `- ${p.name} (${p.status}, ${p.priority}): ${p.assignedEmployees.length} employees`
).join('\n')}

RECENT UPDATE PATTERNS:
${updates.slice(0, 10).map((u: WeeklyUpdate, i: number) => 
  `${i+1}. [${u.employeeId}] ${u.messageText.slice(0, 100)}... (Projects: ${u.projects.join(', ')})`
).join('\n')}

TASK STATUS DISTRIBUTION:
${tasks.reduce((acc: Record<string, number>, t: Task) => {
  acc[t.status] = (acc[t.status] || 0) + 1;
  return acc;
}, {} as Record<string, number>)}

IDENTIFY KNOWLEDGE GAPS in these categories:
1. MISSING_DEPENDENCY: Unclear project dependencies or integration points
2. UNCLEAR_TIMELINE: Vague deadlines, missing milestone dates, uncertain delivery schedules
3. RESOURCE_CONSTRAINT: Unclear resource needs, capacity issues, skill gaps
4. TECHNICAL_RISK: Unaddressed technical challenges, architecture concerns, integration risks
5. COMMUNICATION_GAP: Missing coordination between teams, unclear handoffs, silent stakeholders
6. SCOPE_AMBIGUITY: Unclear requirements, changing scope, undefined acceptance criteria

For each gap, analyze:
- Which projects/employees are affected
- What specific information is missing
- Why this gap could impact project success
- Evidence from the updates that supports this gap

RESPONSE FORMAT (JSON Array):
[
  {
    "type": "missing_dependency",
    "severity": "high",
    "description": "Specific description of what information is missing",
    "affectedProjects": ["project1", "project2"],
    "affectedEmployees": ["emp1", "emp2"], 
    "evidence": ["Quote from update showing the gap", "Another supporting quote"],
    "impact": "How this gap could affect project outcomes",
    "confidence": 85
  }
]

ANALYSIS REQUIREMENTS:
- Focus on actionable gaps that management can address
- Use evidence from actual updates to support each gap
- Prioritize gaps that could impact multiple projects or critical timelines
- Be specific about what information is missing, not just general concerns
- Confidence should reflect strength of evidence and clarity of the gap`;
  }

  private parseGapAnalysisResponse(response: string): KnowledgeGap[] {
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      const gaps = Array.isArray(parsed) ? parsed : [parsed];

      return gaps.map((gap: any, index: number) => ({
        id: `ai-gap-${Date.now()}-${index}`,
        type: gap.type || 'communication_gap',
        severity: gap.severity || 'medium',
        description: gap.description || 'Knowledge gap identified',
        affectedProjects: gap.affectedProjects || [],
        affectedEmployees: gap.affectedEmployees || [],
        evidence: gap.evidence || [],
        impact: gap.impact || 'Potential project impact',
        confidence: gap.confidence || 70
      }));
    } catch (error) {
      console.error('[KNOWLEDGE_GAP_AGENT] Error parsing gap analysis:', error);
      return [];
    }
  }

  private detectRuleBasedGaps(data: any): KnowledgeGap[] {
    const gaps: KnowledgeGap[] = [];
    const { updates, projects, tasks, employees } = data;

    // Gap 1: Projects with no recent updates
    const activeProjects = projects.filter((p: Project) => p.status === 'active');
    const projectsWithUpdates = new Set(updates.flatMap((u: WeeklyUpdate) => u.projects));
    
    activeProjects.forEach((project: Project) => {
      if (!projectsWithUpdates.has(project.id)) {
        gaps.push({
          id: `silent-project-${project.id}`,
          type: 'communication_gap',
          severity: 'medium',
          description: `Project "${project.name}" has no recent status updates from team members`,
          affectedProjects: [project.id],
          affectedEmployees: project.assignedEmployees,
          evidence: ['No updates found in recent timeframe'],
          impact: 'Project status and progress unclear to management',
          confidence: 90
        });
      }
    });

    // Gap 2: Employees with blocked tasks but no escalation
    const blockedTasks = tasks.filter((t: Task) => t.status === 'blocked');
    const employeesWithBlockedTasks = new Set(blockedTasks.map((t: Task) => t.employeeId));
    
    Array.from(employeesWithBlockedTasks).forEach((employeeId) => {
      const employeeUpdates = updates.filter((u: WeeklyUpdate) => u.employeeId === employeeId);
      const mentionsBlocked = employeeUpdates.some((u: WeeklyUpdate) => 
        u.messageText.toLowerCase().includes('block') || 
        u.messageText.toLowerCase().includes('stuck') ||
        u.messageText.toLowerCase().includes('waiting')
      );
      
      if (!mentionsBlocked) {
        gaps.push({
          id: `blocked-silence-${employeeId}`,
          type: 'communication_gap',
          severity: 'high',
          description: `Employee has blocked tasks but hasn't reported the blockers in recent updates`,
          affectedProjects: blockedTasks.filter((t: Task) => t.employeeId === employeeId).map((t: Task) => t.projectId || ''),
          affectedEmployees: [employeeId as string],
          evidence: [`${blockedTasks.filter((t: Task) => t.employeeId === employeeId).length} blocked tasks without status updates`],
          impact: 'Blocked work may delay project timelines without management awareness',
          confidence: 80
        });
      }
    });

    // Gap 3: Projects with high priority but low update frequency
    const highPriorityProjects = projects.filter((p: Project) => p.priority === 'critical' || p.priority === 'high');
    highPriorityProjects.forEach((project: Project) => {
      const projectUpdates = updates.filter((u: WeeklyUpdate) => u.projects.includes(project.id));
      const updateFrequency = projectUpdates.length / project.assignedEmployees.length;
      
      if (updateFrequency < 1) { // Less than 1 update per employee in timeframe
        gaps.push({
          id: `low-comms-${project.id}`,
          type: 'communication_gap',
          severity: 'medium',
          description: `High-priority project "${project.name}" has low communication frequency relative to team size`,
          affectedProjects: [project.id],
          affectedEmployees: project.assignedEmployees,
          evidence: [`${projectUpdates.length} updates from ${project.assignedEmployees.length} team members`],
          impact: 'High-priority project may have hidden risks or delays',
          confidence: 75
        });
      }
    });

    return gaps;
  }

  private async generateQuestions(gaps: KnowledgeGap[], data: any): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];

    for (const gap of gaps) {
      if (gap.affectedEmployees.length === 0) continue;

      // Generate questions for each affected employee
      for (const employeeId of gap.affectedEmployees) {
        const employee = data.employees.find((e: Employee) => e.id === employeeId);
        if (!employee) continue;

        const questionPrompt = this.buildQuestionGenerationPrompt(gap, employee, data);
        
        try {
          const geminiResponse = await this.gemini.generateText(questionPrompt);
          const generatedQuestion = this.parseQuestionResponse(geminiResponse, gap, employee);
          if (generatedQuestion) {
            questions.push(generatedQuestion);
          }
        } catch (error) {
          console.error(`[KNOWLEDGE_GAP_AGENT] Error generating question for ${employeeId}:`, error);
          
          // Fallback to template-based question
          const fallbackQuestion = this.generateFallbackQuestion(gap, employee);
          if (fallbackQuestion) {
            questions.push(fallbackQuestion);
          }
        }
      }
    }

    return questions;
  }

  private buildQuestionGenerationPrompt(gap: KnowledgeGap, employee: Employee, data: any): string {
    const employeeUpdates = data.updates.filter((u: WeeklyUpdate) => u.employeeId === employee.id);
    
    return `Generate a targeted question to ask ${employee.displayName} to address a specific knowledge gap.

KNOWLEDGE GAP:
- Type: ${gap.type}
- Severity: ${gap.severity}  
- Description: ${gap.description}
- Impact: ${gap.impact}

EMPLOYEE CONTEXT:
- Name: ${employee.displayName}
- Email: ${employee.email}
- Recent Updates: ${employeeUpdates.length}
- Recent Work: ${employeeUpdates.slice(0, 2).map((u: WeeklyUpdate) => u.messageText.slice(0, 100)).join('; ')}

AFFECTED PROJECTS: ${gap.affectedProjects.join(', ')}

QUESTION REQUIREMENTS:
- Be specific and actionable
- Reference the employee's recent work when relevant
- Ask for concrete information that addresses the gap
- Be professional but direct
- Focus on information that helps management make decisions

RESPONSE FORMAT (JSON):
{
  "question": "Direct, specific question addressing the knowledge gap",
  "context": "Brief explanation of why this information is needed",
  "priority": "low/medium/high/urgent",
  "expectedAnswerType": "timeline/resource/technical/dependency/status/clarification",
  "followUpQuestions": ["Related question 1", "Related question 2"],
  "confidence": 85
}

Generate ONE focused question that directly addresses the knowledge gap.`;
  }

  private parseQuestionResponse(response: string, gap: KnowledgeGap, employee: Employee): GeneratedQuestion | null {
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      return {
        id: `question-${gap.id}-${employee.id}-${Date.now()}`,
        targetEmployeeId: employee.id,
        targetEmployeeName: employee.displayName,
        gapId: gap.id,
        gapType: gap.type,
        question: parsed.question || 'Could you provide more details about your current work status?',
        context: parsed.context || 'Additional information needed for project planning',
        priority: parsed.priority || 'medium',
        expectedAnswerType: parsed.expectedAnswerType || 'clarification',
        followUpQuestions: parsed.followUpQuestions || [],
        confidence: parsed.confidence || 70,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[KNOWLEDGE_GAP_AGENT] Error parsing question response:', error);
      return null;
    }
  }

  private generateFallbackQuestion(gap: KnowledgeGap, employee: Employee): GeneratedQuestion {
    const questionTemplates = {
      missing_dependency: `Hi ${employee.displayName}, could you clarify any dependencies or blockers affecting your work on the projects you're involved in?`,
      unclear_timeline: `Hi ${employee.displayName}, could you provide updated timelines for your current tasks and any potential delays you foresee?`,
      resource_constraint: `Hi ${employee.displayName}, do you have the resources and support needed to complete your current assignments effectively?`,
      technical_risk: `Hi ${employee.displayName}, are there any technical challenges or risks in your current work that management should be aware of?`,
      communication_gap: `Hi ${employee.displayName}, could you provide a status update on your current projects and any coordination needs with other team members?`,
      scope_ambiguity: `Hi ${employee.displayName}, are there any unclear requirements or scope questions in your current projects that need clarification?`
    };

    return {
      id: `fallback-${gap.id}-${employee.id}-${Date.now()}`,
      targetEmployeeId: employee.id,
      targetEmployeeName: employee.displayName,
      gapId: gap.id,
      gapType: gap.type,
      question: questionTemplates[gap.type] || `Hi ${employee.displayName}, could you provide more details about your current work status?`,
      context: `Following up on ${gap.type} identified in recent project analysis`,
      priority: gap.severity === 'critical' ? 'urgent' : gap.severity === 'high' ? 'high' : 'medium',
      expectedAnswerType: 'clarification',
      followUpQuestions: [],
      confidence: 60,
      generatedAt: new Date().toISOString()
    };
  }

  // Helper methods
  private buildProjectEmployeeMap(updates: WeeklyUpdate[], projects: Project[]) {
    const map: Record<string, string[]> = {};
    updates.forEach(update => {
      update.projects.forEach(projectId => {
        if (!map[projectId]) map[projectId] = [];
        if (!map[projectId].includes(update.employeeId)) {
          map[projectId].push(update.employeeId);
        }
      });
    });
    return map;
  }

  private buildEmployeeProjectMap(updates: WeeklyUpdate[]) {
    const map: Record<string, string[]> = {};
    updates.forEach(update => {
      if (!map[update.employeeId]) map[update.employeeId] = [];
      update.projects.forEach(projectId => {
        if (!map[update.employeeId].includes(projectId)) {
          map[update.employeeId].push(projectId);
        }
      });
    });
    return map;
  }

  private inferProjectDependencies(updates: WeeklyUpdate[], projects: Project[]) {
    // Simple dependency inference based on cross-project mentions
    const dependencies: Record<string, string[]> = {};
    updates.forEach(update => {
      if (update.projects.length > 1) {
        update.projects.forEach(projectId => {
          if (!dependencies[projectId]) dependencies[projectId] = [];
          update.projects.forEach(otherProjectId => {
            if (projectId !== otherProjectId && !dependencies[projectId].includes(otherProjectId)) {
              dependencies[projectId].push(otherProjectId);
            }
          });
        });
      }
    });
    return dependencies;
  }

  private deduplicateGaps(gaps: KnowledgeGap[]): KnowledgeGap[] {
    const seen = new Set<string>();
    return gaps.filter(gap => {
      const key = `${gap.type}-${gap.affectedProjects.join(',')}-${gap.affectedEmployees.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

  // Public API methods
  async findCriticalGaps(): Promise<KnowledgeGap[]> {
    const analysis = await this.analyzeKnowledgeGaps({ minSeverity: 'high' });
    return analysis.gaps;
  }

  async generateQuestionsForEmployee(employeeId: string): Promise<GeneratedQuestion[]> {
    const analysis = await this.analyzeKnowledgeGaps({ employeeId });
    return analysis.questions;
  }

  async generateQuestionsForProject(projectId: string): Promise<GeneratedQuestion[]> {
    const analysis = await this.analyzeKnowledgeGaps({ projectId });
    return analysis.questions;
  }
}
