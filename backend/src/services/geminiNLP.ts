import { GoogleGenerativeAI } from '@google/generative-ai';
import { Task } from '../types/index.js';
import { TaskExtractor } from './taskExtractor.js';

export class GeminiNLP {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private modelName: string = '';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GEMINI] GEMINI_API_KEY not found - Gemini features will be disabled');
      return;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Allow override via env; default to models/gemini-2.5-flash
      const desired = (process.env.GEMINI_MODEL || 'models/gemini-2.5-flash').trim();
      const normalize = (m: string) => m.replace(/^models\//, '');
      const primaryModel = normalize(desired);

      try {
        this.model = this.genAI.getGenerativeModel({ model: primaryModel });
        this.modelName = primaryModel;
        console.log(`[GEMINI] Initialized successfully (${primaryModel})`);
      } catch (e) {
        try {
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
          this.modelName = 'gemini-1.5-pro';
          console.log('[GEMINI] Initialized successfully (gemini-1.5-pro fallback)');
        } catch (e2) {
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          this.modelName = 'gemini-1.5-flash';
          console.log('[GEMINI] Initialized successfully (gemini-1.5-flash fallback)');
        }
      }
    } catch (error) {
      console.error('[GEMINI] Failed to initialize:', error);
    }
  }

  public async extractTasks(messageText: string, employeeId: string): Promise<Task[]> {
    if (!this.model) {
      console.log('[GEMINI] Model not available, using fallback extraction');
      return this.fallbackTaskExtraction(messageText, employeeId);
    }
    
    try {
      const prompt = this.buildTaskExtractionPrompt(messageText);
      console.log(`[GEMINI] extractTasks model=${this.modelName} promptLen=${prompt.length} msgLen=${messageText.length}`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      console.log(`[GEMINI] extractTasks responseLen=${text.length}`);
      
      // Parse the JSON response from Gemini
      const parsedTasks = this.parseGeminiResponse(text, employeeId);
      
      console.log('[GEMINI] Extracted tasks:', parsedTasks.length);
      return parsedTasks;
      
    } catch (error) {
      console.error(`[GEMINI] Error extracting tasks (model=${this.modelName}):`, error);
      // Fallback to basic extraction if Gemini fails
      return this.fallbackTaskExtraction(messageText, employeeId);
    }
  }

  public async analyzeSentiment(messageText: string): Promise<'positive' | 'neutral' | 'negative' | 'blocked'> {
    if (!this.model) {
      console.log('[GEMINI] Model not available, using fallback sentiment analysis');
      return this.fallbackSentimentAnalysis(messageText);
    }
    
    try {
      const prompt = this.buildSentimentPrompt(messageText);
      console.log(`[GEMINI] analyzeSentiment model=${this.modelName} promptLen=${prompt.length} msgLen=${messageText.length}`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim().toLowerCase();
      console.log(`[GEMINI] Sentiment analysis raw='${text.slice(0, 100)}'`);
      
      // Parse sentiment response
      if (text.includes('blocked') || text.includes('stuck')) return 'blocked';
      if (text.includes('positive') || text.includes('good') || text.includes('great')) return 'positive';
      if (text.includes('negative') || text.includes('bad') || text.includes('poor')) return 'negative';
      return 'neutral';
      
    } catch (error) {
      console.error(`[GEMINI] Error analyzing sentiment (model=${this.modelName}):`, error);
      return this.fallbackSentimentAnalysis(messageText);
    }
  }

  public async categorizeProject(taskDescription: string, existingProjects: string[]): Promise<string | null> {
    if (!this.model) {
      console.log('[GEMINI] Model not available, skipping project categorization');
      return null;
    }
    
    try {
      const prompt = this.buildProjectCategorizationPrompt(taskDescription, existingProjects);
      console.log(`[GEMINI] categorizeProject model=${this.modelName} promptLen=${prompt.length} projects=${existingProjects.length}`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      console.log(`[GEMINI] Project categorization raw='${text.slice(0, 120)}'`);
      
      // Check if Gemini suggested an existing project
      const lowerText = text.toLowerCase();
      for (const project of existingProjects) {
        if (lowerText.includes(project.toLowerCase())) {
          return project;
        }
      }
      
      // Check if Gemini suggested a new project
      if (lowerText.includes('new project:')) {
        const newProjectMatch = text.match(/new project:\s*(.+)/i);
        if (newProjectMatch) {
          return newProjectMatch[1].trim();
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`[GEMINI] Error categorizing project (model=${this.modelName}):`, error);
      return null;
    }
  }

  private buildTaskExtractionPrompt(messageText: string): string {
    return `
You are an AI assistant that extracts tasks from employee weekly update messages. 
Analyze the following message and extract individual tasks, their status, and priority.

Message: "${messageText}"

Please respond with a JSON array of tasks. Each task should have this structure:
{
  "title": "Brief task title (max 100 chars)",
  "description": "Full task description", 
  "status": "completed|in-progress|blocked|not-started",
  "priority": "low|medium|high|critical",
  "tags": ["relevant", "keywords"],
  "estimatedHours": number or null,
  "dueDate": "YYYY-MM-DD" or null
}

Guidelines:
- Extract concrete, actionable tasks only
- Ignore general statements like "had a good week"
- Infer status from context (completed = "finished", "done", "shipped"; in-progress = "working on", "currently"; blocked = "waiting for", "stuck"; not-started = "will", "planning")
- Infer priority from urgency words (critical = "urgent", "asap"; high = "important", "priority"; medium = default; low = "later", "nice to have")
- Extract relevant tags from technology, project, or domain mentions
- Estimate hours if mentioned or can be reasonably inferred
- Extract due dates if mentioned

Respond with ONLY the JSON array, no other text.
`;
  }

  private buildSentimentPrompt(messageText: string): string {
    return `
Analyze the sentiment of this employee weekly update message:

"${messageText}"

Classify the overall sentiment as one of:
- POSITIVE: Progress is good, tasks completed, feeling motivated
- NEGATIVE: Behind schedule, frustrated, challenges without solutions
- BLOCKED: Explicitly mentions blockers, waiting for help, stuck
- NEUTRAL: Factual reporting, mixed progress, normal updates

Respond with only the classification word (POSITIVE, NEGATIVE, BLOCKED, or NEUTRAL).
`;
  }

  private buildProjectCategorizationPrompt(taskDescription: string, existingProjects: string[]): string {
    return `
Given this task: "${taskDescription}"

And these existing projects: ${existingProjects.join(', ')}

Determine if this task belongs to an existing project or needs a new project.

Guidelines:
- Match tasks to existing projects based on domain, technology, or purpose
- Only suggest a new project if the task is clearly different from existing ones
- Consider project scope and relevance

Respond in one of these formats:
- If it matches an existing project: "EXISTING: [project name]"
- If it needs a new project: "NEW PROJECT: [suggested project name]"
- If unclear/general task: "GENERAL"
`;
  }

  private parseGeminiResponse(responseText: string, employeeId: string): Task[] {
    try {
      // Clean up the response text
      let cleanText = responseText.trim();
      
      // Remove markdown code blocks if present
      cleanText = cleanText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();

      // Parse JSON, with fallback extraction of first array
      let tasksData: any;
      let parsedVia: 'direct' | 'extracted' = 'direct';
      try {
        tasksData = JSON.parse(cleanText);
      } catch {
        const extracted = this.extractFirstJsonArray(cleanText);
        if (!extracted) {
          throw new Error('No JSON array found in response');
        }
        tasksData = JSON.parse(extracted);
        parsedVia = 'extracted';
      }
      console.log(`[GEMINI] parseGeminiResponse parsedVia=${parsedVia} length=${Array.isArray(tasksData) ? tasksData.length : 'n/a'}`);
      
      if (!Array.isArray(tasksData)) {
        console.warn('[GEMINI] Response is not an array:', tasksData);
        return [];
      }
      
      // Convert to Task objects
      const tasks: Task[] = tasksData.map((taskData: any) => ({
        id: this.generateTaskId(),
        employeeId,
        title: taskData.title || 'Untitled Task',
        description: taskData.description || taskData.title || '',
        status: this.validateStatus(taskData.status) || 'in-progress',
        priority: this.validatePriority(taskData.priority) || 'medium',
        estimatedHours: taskData.estimatedHours || undefined,
        dueDate: taskData.dueDate || undefined,
        tags: Array.isArray(taskData.tags) ? taskData.tags : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      return tasks.filter(task => task.title.length > 3); // Filter out very short titles
      
    } catch (error) {
      console.error('[GEMINI] Error parsing response:', error);
      console.error('[GEMINI] Raw response was:', responseText);
      return [];
    }
  }

  private extractFirstJsonArray(text: string): string | null {
    const start = text.indexOf('[');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  private validateStatus(status: string): Task['status'] | null {
    const validStatuses: Task['status'][] = ['completed', 'in-progress', 'blocked', 'not-started', 'cancelled'];
    return validStatuses.includes(status as Task['status']) ? status as Task['status'] : null;
  }

  private validatePriority(priority: string): Task['priority'] | null {
    const validPriorities: Task['priority'][] = ['low', 'medium', 'high', 'critical'];
    return validPriorities.includes(priority as Task['priority']) ? priority as Task['priority'] : null;
  }

  private generateTaskId(): string {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Fallback methods for when Gemini is unavailable
  private fallbackTaskExtraction(messageText: string, employeeId: string): Task[] {
    console.log('[GEMINI] Using fallback task extraction (TaskExtractor)');
    try {
      const tasks = TaskExtractor.extractTasks(messageText, employeeId);
      return tasks;
    } catch (e) {
      console.warn('[GEMINI] TaskExtractor failed, using minimal keyword heuristic');
      const sentences = messageText.split(/[.!?]+/).filter(s => s.trim().length > 3);
      const tasks: Task[] = [];
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (this.looksLikeTask(trimmed)) {
          tasks.push({
            id: this.generateTaskId(),
            employeeId,
            title: trimmed.slice(0, 100),
            description: trimmed,
            status: this.inferStatusFromText(trimmed),
            priority: 'medium',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return tasks;
    }
  }

  private looksLikeTask(text: string): boolean {
    const taskKeywords = ['completed', 'working on', 'worked on', 'finishing', 'finished', 'started', 'starting', 'will', 'need to', 'planning', 'plan to', 'next week'];
    const lowerText = text.toLowerCase();
    return taskKeywords.some(keyword => lowerText.includes(keyword));
  }

  private inferStatusFromText(text: string): Task['status'] {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('completed') || lowerText.includes('finished') || lowerText.includes('done')) {
      return 'completed';
    }
    if (lowerText.includes('blocked') || lowerText.includes('waiting') || lowerText.includes('stuck')) {
      return 'blocked';
    }
    if (lowerText.includes('will') || lowerText.includes('planning') || lowerText.includes('going to')) {
      return 'not-started';
    }
    return 'in-progress';
  }

  private fallbackSentimentAnalysis(messageText: string): 'positive' | 'neutral' | 'negative' | 'blocked' {
    console.log('[GEMINI] Using fallback sentiment analysis');
    
    const lowerText = messageText.toLowerCase();
    
    // Check for blocked indicators first
    const blockedKeywords = ['blocked', 'stuck', 'waiting', "can't", 'issue', 'problem', 'help needed'];
    if (blockedKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'blocked';
    }
    
    // Check for positive indicators
    const positiveKeywords = ['completed', 'finished', 'done', 'success', 'great', 'good', 'progress', 'achieved'];
    const positiveCount = positiveKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    // Check for negative indicators
    const negativeKeywords = ['delayed', 'behind', 'difficult', 'challenging', 'slow', 'issues', 'problems'];
    const negativeCount = negativeKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }
    
    return 'neutral';
  }
}
