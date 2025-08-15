import { Task } from '../types/index.js';

export class TaskExtractor {
  private static readonly TASK_PATTERNS = [
    // Completed tasks
    /(?:completed|finished|done|shipped|delivered|closed)\s+(.+?)(?:\.|$|,)/gi,
    /(?:✓|✔|☑)\s*(.+?)(?:\.|$|,)/gi,
    
    // In progress tasks
    /(?:working on|currently|in progress|continuing)\s+(.+?)(?:\.|$|,)/gi,
    /(?:started|began|beginning)\s+(.+?)(?:\.|$|,)/gi,
    
    // Blocked tasks
    /(?:blocked on|waiting for|stuck on|can't proceed)\s+(.+?)(?:\.|$|,)/gi,
    /(?:need help with|need assistance)\s+(.+?)(?:\.|$|,)/gi,
    
    // Planned/upcoming tasks
    /(?:will work on|planning to|next week|going to)\s+(.+?)(?:\.|$|,)/gi,
    /(?:scheduled|planning)\s+(.+?)(?:\.|$|,)/gi,
  ];

  private static readonly STATUS_KEYWORDS = {
    completed: ['completed', 'finished', 'done', 'shipped', 'delivered', 'closed', '✓', '✔', '☑'],
    'in-progress': ['working on', 'currently', 'in progress', 'continuing', 'started', 'began'],
    blocked: ['blocked', 'waiting for', 'stuck', "can't proceed", 'need help', 'need assistance'],
    'not-started': ['will work on', 'planning to', 'next week', 'going to', 'scheduled', 'planning']
  };

  private static readonly PRIORITY_KEYWORDS = {
    critical: ['urgent', 'critical', 'asap', 'emergency', 'high priority'],
    high: ['important', 'high', 'priority', 'soon'],
    medium: ['medium', 'normal', 'regular'],
    low: ['low', 'later', 'when time permits', 'nice to have']
  };

  private static readonly PROJECT_PATTERNS = [
    /(?:project|proj)\s+([A-Za-z0-9\-_]+)/gi,
    /(?:for|on)\s+([A-Z][A-Za-z0-9\-_]*(?:\s+[A-Z][A-Za-z0-9\-_]*)*)/g,
  ];

  public static extractTasks(messageText: string, employeeId: string): Task[] {
    const tasks: Task[] = [];
    const processedText = this.cleanText(messageText);
    
    // Extract tasks using patterns
    for (const pattern of this.TASK_PATTERNS) {
      const matches = [...processedText.matchAll(pattern)];
      for (const match of matches) {
        const taskText = match[1]?.trim();
        if (taskText && taskText.length > 3) {
          const task = this.createTaskFromText(taskText, employeeId, processedText);
          if (task) {
            tasks.push(task);
          }
        }
      }
    }

    // If no patterns matched, try to extract from bullet points or line breaks
    if (tasks.length === 0) {
      tasks.push(...this.extractFromStructuredText(processedText, employeeId));
    }

    // Remove duplicates and merge similar tasks
    return this.deduplicateTasks(tasks);
  }

  private static cleanText(text: string): string {
    return text
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static createTaskFromText(taskText: string, employeeId: string, fullText: string): Task | null {
    if (taskText.length < 5 || taskText.length > 200) {
      return null;
    }

    const id = this.generateTaskId();
    const status = this.detectStatus(taskText, fullText);
    const priority = this.detectPriority(taskText, fullText);
    const projectId = this.detectProject(taskText, fullText);

    return {
      id,
      projectId,
      employeeId,
      title: this.cleanTaskTitle(taskText),
      description: taskText,
      status,
      priority,
      tags: this.extractTags(taskText),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private static extractFromStructuredText(text: string, employeeId: string): Task[] {
    const tasks: Task[] = [];
    
    // Look for bullet points or numbered lists
    const bulletPatterns = [
      /(?:^|\n)\s*[-•*]\s*(.+?)(?=\n|$)/gm,
      /(?:^|\n)\s*\d+\.\s*(.+?)(?=\n|$)/gm,
    ];

    for (const pattern of bulletPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const taskText = match[1]?.trim();
        if (taskText && taskText.length > 3) {
          const task = this.createTaskFromText(taskText, employeeId, text);
          if (task) {
            tasks.push(task);
          }
        }
      }
    }

    return tasks;
  }

  private static detectStatus(taskText: string, fullText: string): Task['status'] {
    const lowerText = (taskText + ' ' + fullText).toLowerCase();
    
    for (const [status, keywords] of Object.entries(this.STATUS_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        return status as Task['status'];
      }
    }
    
    return 'in-progress'; // Default status
  }

  private static detectPriority(taskText: string, fullText: string): Task['priority'] {
    const lowerText = (taskText + ' ' + fullText).toLowerCase();
    
    for (const [priority, keywords] of Object.entries(this.PRIORITY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        return priority as Task['priority'];
      }
    }
    
    return 'medium'; // Default priority
  }

  private static detectProject(taskText: string, fullText: string): string | undefined {
    const text = taskText + ' ' + fullText;
    
    for (const pattern of this.PROJECT_PATTERNS) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        return matches[0][1]?.trim();
      }
    }
    
    return undefined;
  }

  private static extractTags(taskText: string): string[] {
    const tags: string[] = [];
    
    // Extract hashtags
    const hashtagMatches = taskText.match(/#[\w-]+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.substring(1)));
    }
    
    // Extract technology/tool mentions
    const techPatterns = [
      /\b(React|Vue|Angular|Node|Python|Java|TypeScript|JavaScript|SQL|AWS|GCP|Docker|Kubernetes)\b/gi,
      /\b(API|database|frontend|backend|mobile|web|testing|deployment)\b/gi,
    ];
    
    for (const pattern of techPatterns) {
      const matches = taskText.match(pattern);
      if (matches) {
        tags.push(...matches.map(match => match.toLowerCase()));
      }
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private static cleanTaskTitle(taskText: string): string {
    return taskText
      .replace(/^(completed|finished|done|working on|currently|will work on)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100); // Limit title length
  }

  private static deduplicateTasks(tasks: Task[]): Task[] {
    const seen = new Set<string>();
    const deduplicated: Task[] = [];
    
    for (const task of tasks) {
      const key = task.title.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(task);
      }
    }
    
    return deduplicated;
  }

  private static generateTaskId(): string {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  public static analyzeSentiment(messageText: string): 'positive' | 'neutral' | 'negative' | 'blocked' {
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

