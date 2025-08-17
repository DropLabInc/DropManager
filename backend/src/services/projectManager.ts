import { Employee, Project, Task, WeeklyUpdate, ProcessUpdateRequest, ProcessUpdateResponse } from '../types/index.js';
import { Firestore } from '@google-cloud/firestore';
import { GeminiNLP } from './geminiNLP.js';
import { SimplePersistence, PersistentData } from './simplePersistence.js';

export class ProjectManager {
  public readonly instanceId: string;
  // In-memory storage for MVP (will be replaced with Firestore)
  private employees: Map<string, Employee> = new Map();
  private projects: Map<string, Project> = new Map();
  private tasks: Map<string, Task> = new Map();
  private updates: Map<string, WeeklyUpdate> = new Map();
  private geminiNLP: GeminiNLP;
  private db: Firestore | null = null;
  private persistence: SimplePersistence;

  constructor() {
    this.instanceId = 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this.initializeDefaultProjects();
    this.geminiNLP = new GeminiNLP();
    this.persistence = new SimplePersistence();
    
    // Initialize storage and load existing data
    this.initializeStorage();
    console.log(`[PROJECT_MANAGER] Constructed instance ${this.instanceId}`);
  }

  private initializeStorage(): void {
    // Try Firestore first
    this.initializeFirestore();
    
    // Always load from simple persistence (works regardless of Firestore)
    this.loadFromSimplePersistence().catch(err => {
      console.warn('[PROJECT_MANAGER] Failed to load from simple persistence:', err);
    });
  }

  private initializeFirestore(): void {
    try {
      // Try multiple configuration approaches
      let projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
      
      // If no project ID is set, try to detect from environment
      if (!projectId) {
        console.log('[PROJECT_MANAGER] No GOOGLE_CLOUD_PROJECT set, trying alternative configurations...');
        
        // For local development, we can use a default project
        projectId = 'dropmanager-local-dev';
        console.log('[PROJECT_MANAGER] Using default project ID for local development:', projectId);
      }

      // Initialize Firestore with different auth strategies
      let firestoreConfig: any = { projectId };
      
      // Check if we're in a Google Cloud environment (has default credentials)
      const isGoogleCloudEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                              process.env.GCLOUD_PROJECT || 
                              process.env.K_SERVICE; // Cloud Run indicator

      if (!isGoogleCloudEnv) {
        console.log('[PROJECT_MANAGER] Local development detected, using Firestore with default settings');
        // For local development, Firestore will try to use:
        // 1. GOOGLE_APPLICATION_CREDENTIALS file
        // 2. gcloud application default credentials
        // 3. Firestore emulator if FIRESTORE_EMULATOR_HOST is set
      }

      this.db = new Firestore(firestoreConfig);
      console.log('[PROJECT_MANAGER] Firestore initialized successfully for project:', projectId);

      // Test the connection and load data asynchronously
      this.testConnectionAndLoadData();

    } catch (initError: any) {
      console.warn('[PROJECT_MANAGER] Firestore initialization failed:', initError.message);
      console.log('[PROJECT_MANAGER] Using in-memory storage only');
      this.db = null;
    }
  }

  private async testConnectionAndLoadData(): Promise<void> {
    if (!this.db) return;
    
    try {
      // Test the connection with a simple read
      const testCollection = this.db.collection('_health_check');
      await testCollection.limit(1).get();
      console.log('[PROJECT_MANAGER] Firestore connection test passed');
      
      // Load existing data from Firestore
      await this.loadDataFromFirestore();
    } catch (connectionError: any) {
      console.warn('[PROJECT_MANAGER] Firestore connection failed:', connectionError.message);
      console.log('[PROJECT_MANAGER] Continuing with in-memory storage only');
      this.db = null;
    }
  }

  private async loadFromSimplePersistence(): Promise<void> {
    try {
      const data = await this.persistence.load();
      if (data) {
        // Load employees
        Object.entries(data.employees || {}).forEach(([id, employee]) => {
          this.employees.set(id, employee as Employee);
        });

        // Load projects (but don't override default projects)
        Object.entries(data.projects || {}).forEach(([id, project]) => {
          if (!this.projects.has(id)) {
            this.projects.set(id, project as Project);
          }
        });

        // Load tasks
        Object.entries(data.tasks || {}).forEach(([id, task]) => {
          this.tasks.set(id, task as Task);
        });

        // Load updates
        Object.entries(data.updates || {}).forEach(([id, update]) => {
          this.updates.set(id, update as WeeklyUpdate);
        });

        console.log(`[PROJECT_MANAGER] Loaded from persistence: ${this.employees.size} employees, ${this.updates.size} updates`);
      }
    } catch (error: any) {
      console.warn('[PROJECT_MANAGER] Failed to load from persistence:', error.message);
    }
  }

  private async saveToSimplePersistence(): Promise<void> {
    try {
      const data: PersistentData = {
        employees: Object.fromEntries(this.employees),
        projects: Object.fromEntries(
          Array.from(this.projects.entries()).filter(([id]) => 
            !['general', 'maintenance', 'feature-dev', 'manufacturing'].includes(id)
          )
        ),
        tasks: Object.fromEntries(this.tasks),
        updates: Object.fromEntries(this.updates)
      };

      await this.persistence.save(data);
    } catch (error: any) {
      console.error('[PROJECT_MANAGER] Failed to save to persistence:', error.message);
    }
  }



  private initializeDefaultProjects() {
    // Create some default projects for categorization
    const defaultProjects: Project[] = [
      {
        id: 'general',
        name: 'General Tasks',
        description: 'Miscellaneous tasks not assigned to specific projects',
        status: 'active',
        priority: 'medium',
        assignedEmployees: [],
        tags: ['general'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'maintenance',
        name: 'System Maintenance',
        description: 'Bug fixes, updates, and system maintenance tasks',
        status: 'active',
        priority: 'high',
        assignedEmployees: [],
        tags: ['maintenance', 'bugs'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'development',
        name: 'Feature Development',
        description: 'New feature development and enhancements',
        status: 'active',
        priority: 'high',
        assignedEmployees: [],
        tags: ['development', 'features'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    defaultProjects.forEach(project => {
      this.projects.set(project.id, project);
    });
  }

  public async processUpdate(request: ProcessUpdateRequest): Promise<ProcessUpdateResponse> {
    try {
      // Ensure employee exists
      const employee = await this.getOrCreateEmployee({
        id: request.employeeId,
        email: request.employeeEmail,
        displayName: request.employeeDisplayName,
      });

      // Extract tasks from the message using Gemini
      const extractedTasks = await this.geminiNLP.extractTasks(request.messageText, employee.id);
      
      // Analyze sentiment using Gemini
      const sentiment = await this.geminiNLP.analyzeSentiment(request.messageText);

      // Create weekly update record
      const update: WeeklyUpdate = {
        id: this.generateUpdateId(),
        employeeId: employee.id,
        weekOf: request.weekOf,
        messageText: request.messageText,
        extractedTasks,
        projects: [],
        sentiment,
        hasImages: request.hasImages,
        imageCount: request.imageCount,
        chatMetadata: request.chatMetadata,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };

      // Process and categorize tasks
      const assignedProjects: string[] = [];
      for (const task of extractedTasks) {
        // Save task
        this.tasks.set(task.id, task);
        
        // Assign to project or create new one
        const projectId = await this.assignTaskToProject(task);
        if (projectId && !assignedProjects.includes(projectId)) {
          assignedProjects.push(projectId);
        }
      }

      update.projects = assignedProjects;
      this.updates.set(update.id, update);
      
      // Persist to Firestore
      await this.saveToFirestore('updates', update.id, update);
      for (const task of extractedTasks) {
        await this.saveToFirestore('tasks', task.id, task);
      }

      // Update employee's last update time
      employee.lastUpdateAt = new Date().toISOString();
      this.employees.set(employee.id, employee);
      
      // Save updated employee to Firestore
      await this.saveToFirestore('employees', employee.id, employee);

      return {
        success: true,
        updateId: update.id,
        extractedTasks,
        assignedProjects,
        message: this.generateResponseMessage(extractedTasks, assignedProjects, sentiment)
      };

    } catch (error) {
      console.error('Error processing update:', error);
      return {
        success: false,
        updateId: '',
        extractedTasks: [],
        assignedProjects: [],
        message: 'Sorry, there was an error processing your update. Please try again.'
      };
    }
  }

  private async getOrCreateEmployee(employeeData: { id: string; email: string; displayName: string }): Promise<Employee> {
    let employee = this.employees.get(employeeData.id);
    
    if (!employee) {
      employee = {
        id: employeeData.id,
        email: employeeData.email,
        displayName: employeeData.displayName,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
      };
      this.employees.set(employee.id, employee);
      console.log(`Created new employee: ${employee.displayName} (${employee.email})`);
      
      // Persist to Firestore
      await this.saveToFirestore('employees', employee.id, employee);
    } else {
      // Update display name if it changed
      if (employee.displayName !== employeeData.displayName) {
        employee.displayName = employeeData.displayName;
        this.employees.set(employee.id, employee);
        
        // Save updated employee to Firestore
        await this.saveToFirestore('employees', employee.id, employee);
      }
    }
    
    return employee;
  }

  private async assignTaskToProject(task: Task): Promise<string> {
    // If task already has a project ID, validate it exists
    if (task.projectId && this.projects.has(task.projectId)) {
      return task.projectId;
    }

    // Use Gemini to categorize the task
    const existingProjectNames = Array.from(this.projects.values()).map(p => p.name);
    const taskDescription = task.title + ' ' + (task.description || '');
    
    try {
      const geminiSuggestion = await this.geminiNLP.categorizeProject(taskDescription, existingProjectNames);
      
      if (geminiSuggestion) {
        // Check if it matches an existing project
        const existingProject = Array.from(this.projects.values())
          .find(p => p.name.toLowerCase() === geminiSuggestion.toLowerCase());
        
        if (existingProject) {
          task.projectId = existingProject.id;
          this.tasks.set(task.id, task);
          return existingProject.id;
        }
        
        // Create new project based on Gemini suggestion
        const project = await this.createProjectFromGeminiSuggestion(geminiSuggestion, task);
        task.projectId = project.id;
        this.tasks.set(task.id, task);
        return project.id;
      }
    } catch (error) {
      console.error('[PROJECT_MANAGER] Error with Gemini categorization:', error);
    }

    // Fallback to keyword-based matching
    const matchedProject = this.findMatchingProject(task);
    if (matchedProject) {
      task.projectId = matchedProject.id;
      this.tasks.set(task.id, task);
      return matchedProject.id;
    }

    // Default to general project
    task.projectId = 'general';
    this.tasks.set(task.id, task);
    return 'general';
  }

  private findMatchingProject(task: Task): Project | null {
    const taskText = (task.title + ' ' + (task.description || '')).toLowerCase();
    
    for (const project of this.projects.values()) {
      // Check if task mentions project name
      if (taskText.includes(project.name.toLowerCase())) {
        return project;
      }
      
      // Check if task contains project tags
      const hasMatchingTag = project.tags.some(tag => 
        taskText.includes(tag.toLowerCase()) || 
        task.tags.includes(tag)
      );
      
      if (hasMatchingTag) {
        return project;
      }
    }
    
    return null;
  }

  private shouldCreateNewProject(task: Task): boolean {
    const taskText = (task.title + ' ' + (task.description || '')).toLowerCase();
    
    // Create new project if task mentions "project" explicitly
    if (taskText.includes('project ') || taskText.includes('proj ')) {
      return true;
    }
    
    // Create if it's a high priority task with specific technology focus
    if (task.priority === 'high' || task.priority === 'critical') {
      const techKeywords = ['api', 'database', 'frontend', 'backend', 'mobile', 'web'];
      if (techKeywords.some(keyword => taskText.includes(keyword))) {
        return true;
      }
    }
    
    return false;
  }

  private async createProjectFromTask(task: Task): Promise<Project> {
    const projectName = this.extractProjectName(task);
    const project: Project = {
      id: this.generateProjectId(projectName),
      name: projectName,
      description: `Auto-created project based on task: ${task.title}`,
      status: 'active',
      priority: task.priority,
      assignedEmployees: [task.employeeId],
      tags: [...task.tags, 'auto-created'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.projects.set(project.id, project);
    console.log(`Created new project: ${project.name}`);
    
    return project;
  }

  private async createProjectFromGeminiSuggestion(projectName: string, task: Task): Promise<Project> {
    const project: Project = {
      id: this.generateProjectId(projectName),
      name: projectName,
      description: `AI-suggested project based on task analysis: ${task.title}`,
      status: 'active',
      priority: task.priority,
      assignedEmployees: [task.employeeId],
      tags: [...task.tags, 'ai-created', 'gemini-suggested'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.projects.set(project.id, project);
    console.log(`[GEMINI] Created new project: ${project.name}`);
    
    // Save to Firestore
    await this.saveToFirestore('projects', project.id, project);
    
    return project;
  }

  private extractProjectName(task: Task): string {
    const taskText = task.title + ' ' + (task.description || '');
    
    // Look for explicit project mentions
    const projectMatch = taskText.match(/(?:project|proj)\s+([A-Za-z0-9\-_\s]+)/i);
    if (projectMatch) {
      return projectMatch[1].trim();
    }
    
    // Extract from technology/domain keywords
    const techKeywords = ['API', 'Database', 'Frontend', 'Backend', 'Mobile', 'Web'];
    for (const keyword of techKeywords) {
      if (taskText.toLowerCase().includes(keyword.toLowerCase())) {
        return `${keyword} Development`;
      }
    }
    
    // Default naming based on task
    const words = task.title.split(' ').slice(0, 3);
    return words.join(' ') + ' Project';
  }

  private generateResponseMessage(tasks: Task[], projects: string[], sentiment: string): string {
    if (tasks.length === 0) {
      return "Thanks for your update! I've logged your message. For better tracking, try including specific tasks you're working on.";
    }

    let message = `Great! I've extracted ${tasks.length} task${tasks.length > 1 ? 's' : ''} from your update:\n\n`;
    
    tasks.forEach((task, index) => {
      const status = task.status.replace('-', ' ');
      message += `${index + 1}. ${task.title} (${status})\n`;
    });

    if (projects.length > 0) {
      const projectNames = projects.map(id => this.projects.get(id)?.name || id).join(', ');
      message += `\nAssigned to project${projects.length > 1 ? 's' : ''}: ${projectNames}`;
    }

    if (sentiment === 'blocked') {
      message += "\n\n⚠️ I noticed you mentioned some blockers. Your manager will be notified.";
    } else if (sentiment === 'positive') {
      message += "\n\n🎉 Great progress! Keep up the excellent work!";
    }

    return message;
  }

  // Firestore data loading methods
  private async loadDataFromFirestore(): Promise<void> {
    if (!this.db) {
      console.log('[PROJECT_MANAGER] No Firestore connection, skipping data load');
      return;
    }

    try {
      console.log('[PROJECT_MANAGER] Loading data from Firestore...');
      
      // Load employees
      const employeesSnapshot = await this.db.collection('employees').get();
      employeesSnapshot.forEach((doc: any) => {
        const employee = doc.data() as Employee;
        this.employees.set(employee.id, employee);
      });

      // Load projects (but don't override default projects)
      const projectsSnapshot = await this.db.collection('projects').get();
      projectsSnapshot.forEach((doc: any) => {
        const project = doc.data() as Project;
        // Only add if it's not a default project
        if (!['general', 'maintenance', 'development'].includes(project.id)) {
          this.projects.set(project.id, project);
        }
      });

      // Load tasks
      const tasksSnapshot = await this.db.collection('tasks').get();
      tasksSnapshot.forEach((doc: any) => {
        const task = doc.data() as Task;
        this.tasks.set(task.id, task);
      });

      // Load updates
      const updatesSnapshot = await this.db.collection('updates').get();
      updatesSnapshot.forEach((doc: any) => {
        const update = doc.data() as WeeklyUpdate;
        this.updates.set(update.id, update);
      });

      console.log('[PROJECT_MANAGER] Loaded from Firestore:', {
        employees: this.employees.size,
        projects: this.projects.size,
        tasks: this.tasks.size,
        updates: this.updates.size
      });

    } catch (error) {
      console.error('[PROJECT_MANAGER] Error loading data from Firestore:', error);
    }
  }

  private async saveToFirestore(collection: string, id: string, data: any): Promise<void> {
    // Try Firestore first if available
    if (this.db) {
      try {
        await this.db.collection(collection).doc(id).set(data);
        console.log(`[PROJECT_MANAGER] Saved ${collection}/${id} to Firestore`);
      } catch (error) {
        console.error(`[PROJECT_MANAGER] Error saving ${collection}/${id} to Firestore:`, error);
      }
    }

    // Always save to simple persistence as backup/primary
    await this.saveToSimplePersistence();
  }

  private async deleteFromFirestore(collection: string, id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db.collection(collection).doc(id).delete();
      console.log(`[PROJECT_MANAGER] Deleted ${collection}/${id} from Firestore`);
    } catch (error) {
      console.error(`[PROJECT_MANAGER] Error deleting ${collection}/${id} from Firestore:`, error);
    }
  }

  // Utility methods
  private generateUpdateId(): string {
    return 'update_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateProjectId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return slug + '_' + Date.now();
  }

  // Public getter methods for dashboard/API
  public getEmployees(): Employee[] {
    return Array.from(this.employees.values());
  }

  public getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public getUpdates(): WeeklyUpdate[] {
    return Array.from(this.updates.values());
  }

  public getEmployeeStats(employeeId: string) {
    const tasks = this.getTasks().filter(t => t.employeeId === employeeId);
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      notStarted: tasks.filter(t => t.status === 'not-started').length,
    };
  }

  public getProjectStats(projectId: string) {
    const tasks = this.getTasks().filter(t => t.projectId === projectId);
    const project = this.projects.get(projectId);
    
    return {
      project,
      tasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };
  }

  public getStateSummary() {
    return {
      instanceId: this.instanceId,
      counts: {
        employees: this.employees.size,
        projects: this.projects.size,
        tasks: this.tasks.size,
        updates: this.updates.size,
      },
      sample: {
        latestUpdate: Array.from(this.updates.values()).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())[0],
      }
    };
  }

  // Reset all data (for testing purposes)
  public resetAllData(): void {
    console.log(`[PROJECT_MANAGER] Resetting all data for instance ${this.instanceId}`);
    this.employees.clear();
    this.projects.clear();
    this.tasks.clear();
    this.updates.clear();
    this.initializeDefaultProjects();
    console.log('[PROJECT_MANAGER] Data reset complete');
  }
}
