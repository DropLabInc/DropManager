import { GeminiNLP } from '../services/geminiNLP.js';
import { GeminiContextAnalyzer, GeminiEmployeeContext } from './geminiContextAnalyzer.js';
import { ProjectContextAnalyzer, ProjectContextSummary } from './projectContextAnalyzer.js';
import { ProjectManager } from '../services/projectManager.js';

export interface GeneratedMessage {
  messageText: string;
  senderEmail: string;
  senderDisplay: string;
  messageType: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical' | 'update';
  confidence: number;
}

export class GeminiDataGenerator {
  private gemini: GeminiNLP;
  private contextAnalyzer: GeminiContextAnalyzer;
  private projectContextAnalyzer: ProjectContextAnalyzer;
  private employeeContextCache: Map<string, GeminiEmployeeContext> = new Map();
  private projectContextCache: ProjectContextSummary | null = null;
  private projectContextCacheExpiry: number = 0;

  constructor(storiesPath?: string, projectManager?: ProjectManager) {
    this.gemini = new GeminiNLP();
    this.contextAnalyzer = new GeminiContextAnalyzer(storiesPath);
    this.projectContextAnalyzer = new ProjectContextAnalyzer(projectManager);
  }

  async generateMessage(
    employeeName: string, 
    messageType?: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical' | 'update'
  ): Promise<GeneratedMessage> {
    // Get or cache employee context
    let context = this.employeeContextCache.get(employeeName);
    if (!context) {
      const analyzedContext = await this.contextAnalyzer.analyzeEmployeeContext(employeeName);
      if (!analyzedContext) {
        throw new Error(`Could not analyze context for employee: ${employeeName}`);
      }
      context = analyzedContext;
      this.employeeContextCache.set(employeeName, context);
    }

    // Get fresh project context
    const projectContext = await this.getProjectContext();
    const employeeProjectContext = await this.getEmployeeProjectContext(employeeName);

    // Determine message type if not specified
    const selectedType = messageType || this.selectMessageType();

    // Generate message using Gemini with enhanced context
    const prompt = this.buildEnhancedPrompt(context, selectedType, projectContext, employeeProjectContext);
    const generatedText = await this.gemini.generateText(prompt);

    // Clean and validate the generated message
    const cleanedMessage = this.cleanGeneratedMessage(generatedText);
    const confidence = this.calculateConfidence(cleanedMessage, context);

    return {
      messageText: cleanedMessage,
      senderEmail: context.email,
      senderDisplay: context.displayName,
      messageType: selectedType,
      confidence
    };
  }

  private async getProjectContext(): Promise<ProjectContextSummary | null> {
    const now = Date.now();
    // Cache project context for 5 minutes to avoid excessive API calls
    if (this.projectContextCache && now < this.projectContextCacheExpiry) {
      return this.projectContextCache;
    }

    try {
      this.projectContextCache = await this.projectContextAnalyzer.analyzeProjectEcosystem();
      this.projectContextCacheExpiry = now + (5 * 60 * 1000); // 5 minutes
      return this.projectContextCache;
    } catch (error) {
      console.error('[GEMINI_DATA_GENERATOR] Error getting project context:', error);
      return null;
    }
  }

  private async getEmployeeProjectContext(employeeName: string) {
    try {
      return await this.projectContextAnalyzer.getEmployeeProjectContext(employeeName);
    } catch (error) {
      console.error('[GEMINI_DATA_GENERATOR] Error getting employee project context:', error);
      return null;
    }
  }

  private buildEnhancedPrompt(
    context: GeminiEmployeeContext, 
    messageType: string, 
    projectContext: ProjectContextSummary | null,
    employeeProjectContext: any
  ): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    let prompt = `You are ${context.displayName}, a ${context.expertise.join(' and ')} specialist working on various projects. Generate a realistic weekly check-in message that sounds natural and authentic.

EMPLOYEE CONTEXT:
- Name: ${context.displayName}
- Role: ${context.role}
- Expertise: ${context.expertise.join(', ')}
- Work Style: ${context.workStyle}
- Technologies: ${context.technologies.join(', ')}

PERSONAL WORK HISTORY:
${context.recentActivities.slice(0, 5).map(activity => `- ${activity}`).join('\n')}

KNOWN CHALLENGES:
${context.challenges.slice(0, 3).map(challenge => `- ${challenge}`).join('\n')}`;

    // Add project context if available
    if (employeeProjectContext) {
      prompt += `

CURRENT PROJECT ASSIGNMENTS:
PRIMARY PROJECTS:
${employeeProjectContext.primaryProjects?.map((p: any) => `- ${p.name}: ${p.description} (${p.status}, ${p.priority} priority)
  Goals: ${p.goals.slice(0, 2).join(', ')}
  Current Phase: ${p.currentPhase}
  Team: ${p.teamMembers.slice(0, 3).join(', ')}
  Technologies: ${p.keyTechnologies.slice(0, 4).join(', ')}`).join('\n') || 'None'}

SECONDARY PROJECTS:
${employeeProjectContext.secondaryProjects?.slice(0, 2).map((p: any) => `- ${p.name}: ${p.description} (${p.status})`).join('\n') || 'None'}`;

      if (employeeProjectContext.upcomingDeadlines?.length > 0) {
        prompt += `

UPCOMING DEADLINES:
${employeeProjectContext.upcomingDeadlines.slice(0, 3).join('\n')}`;
      }

      if (employeeProjectContext.recentCollaborations?.length > 0) {
        prompt += `

RECENT COLLABORATIONS:
${employeeProjectContext.recentCollaborations.slice(0, 2).join('\n')}`;
      }
    }

    // Add company-wide project context
    if (projectContext) {
      prompt += `

COMPANY PROJECT LANDSCAPE:
OVERALL PRIORITIES: ${projectContext.overallPriorities.slice(0, 3).join(', ')}
CROSS-PROJECT INITIATIVES: ${projectContext.crossProjectInitiatives.slice(0, 2).join(', ')}`;

      if (projectContext.resourceConstraints.length > 0) {
        prompt += `
CURRENT CONSTRAINTS: ${projectContext.resourceConstraints.slice(0, 2).join(', ')}`;
      }
    }

    prompt += `

PROFESSIONAL SUMMARY:
${context.summary}

`;

    // Add message type specific instructions
    switch (messageType) {
      case 'progress':
        prompt += `Generate a PROGRESS update message (2-3 sentences) about recent work accomplishments. Focus on:
- Specific tasks completed or milestones reached on your assigned projects
- Quantifiable results or improvements that align with project goals
- Next steps that connect to project timelines and team coordination
- Use technical terminology and project-specific language`;
        break;

      case 'technical':
        prompt += `Generate a TECHNICAL update message (2-3 sentences) about technical work or findings. Focus on:
- Technical details about systems, tools, or methodologies used in your projects
- Problem-solving or optimization efforts that advance project objectives
- Technical challenges overcome or discoveries made
- Reference specific technologies and project components you're working with`;
        break;

      case 'challenge':
        prompt += `Generate a CHALLENGE/ROADBLOCK update message (2-3 sentences) about current obstacles. Focus on:
- Specific problems or blockers encountered in your project work
- Impact on project timeline or deliverables
- Proposed solutions or workarounds that consider project constraints
- Resource needs or dependencies that affect project progress`;
        break;

      case 'planning':
        prompt += `Generate a PLANNING update message (2-3 sentences) about upcoming work or coordination. Focus on:
- Future tasks or project phases you'll be working on
- Timeline considerations or scheduling that affects project milestones
- Resource allocation or team coordination needs
- Strategic decisions or prioritization within project context`;
        break;

      case 'completion':
        prompt += `Generate a COMPLETION update message (2-3 sentences) about finished work or deliverables. Focus on:
- Recently completed tasks or project milestones
- Results achieved or deliverables handed off that benefit the project
- Lessons learned or outcomes that inform future project work
- Transition to next phases or handoffs to team members`;
        break;

      case 'update':
      default:
        prompt += `Generate a general UPDATE message (2-3 sentences) about current work status. Focus on:
- Mix of progress, challenges, and upcoming work within project context
- Current focus areas or priorities that align with project goals
- Brief status on key project tasks or deliverables
- Natural, conversational tone that reflects project involvement`;
        break;
    }

    prompt += `

REQUIREMENTS:
- Write in first person as ${context.displayName}
- Keep message 2-3 sentences, direct and concise
- NO greetings, salutations, or conversational fluff (no "Hey team", "Hope everyone is well", etc.)
- NO questions or requests for feedback
- Reference specific projects, technologies, and team members when relevant
- Use domain-specific terminology that matches your expertise
- Sound authentic and realistic, reflecting actual project work
- Start directly with the work update or status
- Focus on facts, progress, and technical details only

MESSAGE:`;

    return prompt;
  }

  private buildPrompt(context: GeminiEmployeeContext, messageType: string): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    let prompt = `You are ${context.displayName}, a ${context.expertise.join(' and ')} specialist working on various projects. Generate a realistic weekly check-in message that sounds natural and authentic.

EMPLOYEE CONTEXT:
- Name: ${context.displayName}
- Role: ${context.role}
- Expertise: ${context.expertise.join(', ')}
- Work Style: ${context.workStyle}
- Active Projects: ${context.projects.join(', ')}
- Technologies: ${context.technologies.join(', ')}

RECENT WORK HISTORY:
${context.recentActivities.slice(0, 5).map(activity => `- ${activity}`).join('\n')}

KNOWN CHALLENGES:
${context.challenges.slice(0, 3).map(challenge => `- ${challenge}`).join('\n')}

PROFESSIONAL SUMMARY:
${context.summary}

`;

    switch (messageType) {
      case 'progress':
        prompt += `Generate a PROGRESS update message (2-3 sentences) about recent work accomplishments. Focus on:
- Specific tasks completed or milestones reached
- Quantifiable results or improvements
- Next steps or upcoming work
- Use technical terminology appropriate for your role`;
        break;

      case 'technical':
        prompt += `Generate a TECHNICAL update message (2-3 sentences) about technical work or findings. Focus on:
- Technical details about systems, tools, or methodologies
- Problem-solving or optimization efforts
- Technical challenges overcome or discoveries made
- Use domain-specific language and terminology`;
        break;

      case 'challenge':
        prompt += `Generate a CHALLENGE/ROADBLOCK update message (2-3 sentences) about current obstacles. Focus on:
- Specific problems or blockers encountered
- Impact on timeline or deliverables
- Proposed solutions or workarounds
- Resource needs or dependencies`;
        break;

      case 'planning':
        prompt += `Generate a PLANNING update message (2-3 sentences) about upcoming work or coordination. Focus on:
- Future tasks or project phases
- Timeline considerations or scheduling
- Resource allocation or team coordination
- Strategic decisions or prioritization`;
        break;

      case 'completion':
        prompt += `Generate a COMPLETION update message (2-3 sentences) about finished work or deliverables. Focus on:
- Recently completed tasks or projects
- Results achieved or deliverables handed off
- Lessons learned or outcomes
- Transition to next phases or projects`;
        break;

      case 'update':
      default:
        prompt += `Generate a general UPDATE message (2-3 sentences) about current work status. Focus on:
- Mix of progress, challenges, and upcoming work
- Current focus areas or priorities
- Brief status on key projects or tasks
- Natural, conversational tone`;
        break;
    }

    prompt += `

REQUIREMENTS:
- Write in first person as ${context.displayName}
- Keep message 2-3 sentences, direct and concise
- NO greetings, salutations, or conversational fluff (no "Hey team", "Hope everyone is well", etc.)
- NO questions or requests for feedback
- Use specific technical terms from your domain
- Reference actual projects: ${context.projects.slice(0, 3).join(', ')}
- Sound authentic and realistic, not generic
- Start directly with the work update or status
- Focus on facts, progress, and technical details only

MESSAGE:`;

    return prompt;
  }

  private cleanGeneratedMessage(rawMessage: string): string {
    // Remove any prompt artifacts or formatting
    let cleaned = rawMessage
      .replace(/^MESSAGE:\s*/i, '')
      .replace(/^Generated message:\s*/i, '')
      .replace(/^Update:\s*/i, '')
      .trim();

    // Remove quotes if the entire message is wrapped in them
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1);
    }

    // Remove common conversational elements that shouldn't be in chatbot updates
    const conversationalPatterns = [
      /^(Hi|Hello|Hey)\s+(team|everyone|all),?\s*/i,
      /^(Hope\s+everyone\s+is\s+well|Hope\s+you're\s+all\s+doing\s+well),?\s*/i,
      /^(Good\s+morning|Good\s+afternoon),?\s*/i,
      /Let\s+me\s+know\s+if\s+you\s+have\s+any\s+questions\.?\s*$/i,
      /Please\s+let\s+me\s+know\s+if\s+you\s+need\s+anything\.?\s*$/i,
      /Thanks\s+for\s+reading\.?\s*$/i,
      /Looking\s+forward\s+to\s+your\s+feedback\.?\s*$/i,
      /Any\s+questions\?\s*$/i,
      /Thanks,?\s*$/i,
      /Best\s+regards,?\s*$/i
    ];

    conversationalPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Clean up any double spaces or extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Ensure proper sentence structure
    if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.';
    }

    // Limit length to reasonable bounds
    if (cleaned.length > 500) {
      const sentences = cleaned.split('. ');
      cleaned = sentences.slice(0, 3).join('. ');
      if (!cleaned.endsWith('.')) {
        cleaned += '.';
      }
    }

    return cleaned;
  }

  private calculateConfidence(message: string, context: GeminiEmployeeContext): number {
    let confidence = 0.5; // Base confidence

    // Check for domain-specific terminology
    const messageLower = message.toLowerCase();
    const relevantTerms = context.technologies.concat(context.expertise);
    const termMatches = relevantTerms.filter(term => messageLower.includes(term.toLowerCase()));
    confidence += Math.min(0.3, termMatches.length * 0.05);

    // Check for project references
    const projectMatches = context.projects.filter(project => 
      messageLower.includes(project.toLowerCase())
    );
    confidence += Math.min(0.2, projectMatches.length * 0.1);

    // Check message length (not too short, not too long)
    if (message.length >= 50 && message.length <= 300) {
      confidence += 0.1;
    }

    // Check for specific, non-generic content
    const genericPhrases = ['working on', 'making progress', 'going well', 'moving forward'];
    const genericMatches = genericPhrases.filter(phrase => messageLower.includes(phrase));
    confidence -= genericMatches.length * 0.05;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private selectMessageType(): 'progress' | 'challenge' | 'completion' | 'planning' | 'technical' | 'update' {
    const types: Array<{ type: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical' | 'update', weight: number }> = [
      { type: 'progress', weight: 0.3 },
      { type: 'technical', weight: 0.25 },
      { type: 'update', weight: 0.2 },
      { type: 'challenge', weight: 0.15 },
      { type: 'planning', weight: 0.07 },
      { type: 'completion', weight: 0.03 }
    ];

    const random = Math.random();
    let cumulative = 0;

    for (const { type, weight } of types) {
      cumulative += weight;
      if (random <= cumulative) {
        return type;
      }
    }

    return 'update'; // Fallback
  }

  async generateBatchMessages(
    count: number, 
    employeeNames?: string[]
  ): Promise<GeneratedMessage[]> {
    const availableEmployees = employeeNames || await this.contextAnalyzer.getAvailableEmployees();
    const messages: GeneratedMessage[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const randomEmployee = availableEmployees[Math.floor(Math.random() * availableEmployees.length)];
        const message = await this.generateMessage(randomEmployee);
        messages.push(message);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[GEMINI_GENERATOR] Error generating message ${i + 1}:`, error);
        // Continue with next message instead of failing completely
      }
    }

    return messages;
  }

  async getEmployeeContext(employeeName: string): Promise<GeminiEmployeeContext | null> {
    let context = this.employeeContextCache.get(employeeName);
    if (!context) {
      const analyzedContext = await this.contextAnalyzer.analyzeEmployeeContext(employeeName);
      if (analyzedContext) {
        context = analyzedContext;
        this.employeeContextCache.set(employeeName, context);
      }
    }
    return context || null;
  }

  async getAvailableEmployees(): Promise<string[]> {
    return this.contextAnalyzer.getAvailableEmployees();
  }

  clearCache(): void {
    this.employeeContextCache.clear();
  }
}
