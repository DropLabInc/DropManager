import { Project, Task, Employee, WeeklyUpdate } from '../types/index.js';
import { ProjectManager } from '../services/projectManager.js';
import { GeminiNLP } from '../services/geminiNLP.js';

export interface ProjectContext {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  goals: string[];
  currentPhase: string;
  keyTechnologies: string[];
  teamMembers: string[];
  recentActivities: string[];
  challenges: string[];
  milestones: string[];
  nextSteps: string[];
  businessImpact: string;
  timeline: string;
}

export interface ProjectContextSummary {
  activeProjects: ProjectContext[];
  projectRelationships: { [projectId: string]: string[] }; // Related project IDs
  overallPriorities: string[];
  crossProjectInitiatives: string[];
  resourceConstraints: string[];
}

export class ProjectContextAnalyzer {
  private gemini: GeminiNLP;
  private projectManager: ProjectManager | null = null;

  constructor(projectManager?: ProjectManager) {
    this.gemini = new GeminiNLP();
    this.projectManager = projectManager || null;
  }

  /**
   * Analyze all active projects and create rich context for message generation
   */
  public async analyzeProjectEcosystem(): Promise<ProjectContextSummary> {
    if (!this.projectManager) {
      throw new Error('ProjectManager instance required for project analysis');
    }

    const projects = this.projectManager.getProjects().filter(p => p.status === 'active');
    const tasks = this.projectManager.getTasks();
    const employees = this.projectManager.getEmployees();
    const updates = this.projectManager.getUpdates();

    const projectContexts = await Promise.all(
      projects.map(project => this.analyzeIndividualProject(project, tasks, employees, updates))
    );

    // Analyze relationships between projects
    const projectRelationships = this.analyzeProjectRelationships(projectContexts, tasks);
    
    // Extract overall priorities and initiatives
    const overallPriorities = this.extractOverallPriorities(projectContexts);
    const crossProjectInitiatives = this.identifyCrossProjectInitiatives(projectContexts, tasks);
    const resourceConstraints = this.identifyResourceConstraints(projectContexts, employees, tasks);

    return {
      activeProjects: projectContexts,
      projectRelationships,
      overallPriorities,
      crossProjectInitiatives,
      resourceConstraints
    };
  }

  /**
   * Get project context specifically for an employee
   */
  public async getEmployeeProjectContext(employeeId: string): Promise<{
    primaryProjects: ProjectContext[];
    secondaryProjects: ProjectContext[];
    upcomingDeadlines: string[];
    recentCollaborations: string[];
  }> {
    if (!this.projectManager) {
      throw new Error('ProjectManager instance required');
    }

    const allProjects = await this.analyzeProjectEcosystem();
    const employeeTasks = this.projectManager.getTasks().filter(t => t.employeeId === employeeId);
    const employeeUpdates = this.projectManager.getUpdates().filter(u => u.employeeId === employeeId);

    // Categorize projects by employee involvement
    const primaryProjects = allProjects.activeProjects.filter(p => 
      p.teamMembers.includes(employeeId) && 
      employeeTasks.some(t => t.projectId === p.id && t.status === 'in-progress')
    );

    const secondaryProjects = allProjects.activeProjects.filter(p => 
      !primaryProjects.includes(p) && 
      (p.teamMembers.includes(employeeId) || employeeTasks.some(t => t.projectId === p.id))
    );

    // Extract upcoming deadlines
    const upcomingDeadlines = employeeTasks
      .filter(t => t.dueDate && t.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 3)
      .map(t => `${t.title} (due ${t.dueDate})`);

    // Find recent collaborations
    const recentCollaborations = this.findRecentCollaborations(employeeId, employeeUpdates, allProjects.activeProjects);

    return {
      primaryProjects,
      secondaryProjects,
      upcomingDeadlines,
      recentCollaborations
    };
  }

  private async analyzeIndividualProject(
    project: Project, 
    allTasks: Task[], 
    allEmployees: Employee[], 
    allUpdates: WeeklyUpdate[]
  ): Promise<ProjectContext> {
    const projectTasks = allTasks.filter(t => t.projectId === project.id);
    const projectUpdates = allUpdates.filter(u => u.projects.includes(project.id));
    
    // Get team members working on this project
    const teamMemberIds = [...new Set([
      ...project.assignedEmployees,
      ...projectTasks.map(t => t.employeeId)
    ])];
    
    const teamMembers = teamMemberIds
      .map(id => allEmployees.find(e => e.id === id)?.displayName || id)
      .filter(Boolean);

    // Extract recent activities from updates
    const recentActivities = projectUpdates
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(u => u.messageText.substring(0, 100) + '...');

    // Identify challenges from blocked tasks and negative sentiment
    const challenges = [
      ...projectTasks.filter(t => t.status === 'blocked').map(t => `Blocked: ${t.title}`),
      ...projectUpdates.filter(u => u.sentiment === 'negative' || u.sentiment === 'blocked')
        .slice(0, 2)
        .map(u => `Issue: ${u.messageText.substring(0, 80)}...`)
    ];

    // Extract technologies from task descriptions
    const keyTechnologies = this.extractTechnologies(projectTasks, projectUpdates);

    // Generate enhanced context using Gemini
    const enhancedContext = await this.generateEnhancedProjectContext(
      project, 
      projectTasks, 
      recentActivities, 
      challenges
    );

    return {
      id: project.id,
      name: project.name,
      description: project.description || enhancedContext.description,
      status: project.status,
      priority: project.priority,
      goals: enhancedContext.goals,
      currentPhase: enhancedContext.currentPhase,
      keyTechnologies,
      teamMembers,
      recentActivities,
      challenges,
      milestones: enhancedContext.milestones,
      nextSteps: enhancedContext.nextSteps,
      businessImpact: enhancedContext.businessImpact,
      timeline: enhancedContext.timeline
    };
  }

  private async generateEnhancedProjectContext(
    project: Project,
    tasks: Task[],
    recentActivities: string[],
    challenges: string[]
  ): Promise<{
    description: string;
    goals: string[];
    currentPhase: string;
    milestones: string[];
    nextSteps: string[];
    businessImpact: string;
    timeline: string;
  }> {
    const prompt = `Analyze this project and provide structured context:

PROJECT: ${project.name}
DESCRIPTION: ${project.description || 'No description provided'}
STATUS: ${project.status}
PRIORITY: ${project.priority}

RECENT TASKS:
${tasks.slice(0, 10).map(t => `- ${t.title} (${t.status})`).join('\n')}

RECENT ACTIVITIES:
${recentActivities.slice(0, 3).join('\n')}

CHALLENGES:
${challenges.slice(0, 3).join('\n')}

Based on this information, provide a JSON response with:
{
  "description": "Enhanced 2-sentence project description",
  "goals": ["goal1", "goal2", "goal3"],
  "currentPhase": "current development phase",
  "milestones": ["milestone1", "milestone2"],
  "nextSteps": ["step1", "step2", "step3"],
  "businessImpact": "1-sentence business value",
  "timeline": "estimated timeline or phase duration"
}

Focus on making this sound realistic and domain-appropriate for a biomedical/engineering company.`;

    try {
      const response = await this.gemini.generateText(prompt);
      
      // Clean up potential markdown formatting
      let cleanResponse = response.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
      
      const parsed = JSON.parse(cleanResponse);
      return {
        description: parsed.description || project.description || 'Project description not available',
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        currentPhase: parsed.currentPhase || 'Active development',
        milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
        businessImpact: parsed.businessImpact || 'Supporting company objectives',
        timeline: parsed.timeline || 'Ongoing'
      };
    } catch (error) {
      console.error('[PROJECT_CONTEXT] Error generating enhanced context:', error);
      return {
        description: project.description || 'Project description not available',
        goals: [],
        currentPhase: 'Active development',
        milestones: [],
        nextSteps: [],
        businessImpact: 'Supporting company objectives',
        timeline: 'Ongoing'
      };
    }
  }

  private extractTechnologies(tasks: Task[], updates: WeeklyUpdate[]): string[] {
    const techKeywords = new Set<string>();
    const techPatterns = [
      /\b(python|javascript|typescript|react|node|express|docker|kubernetes|aws|gcp|azure)\b/gi,
      /\b(sql|mongodb|postgresql|redis|elasticsearch)\b/gi,
      /\b(api|rest|graphql|microservice|serverless)\b/gi,
      /\b(ci\/cd|jenkins|github|gitlab|terraform)\b/gi,
      /\b(machine learning|ml|ai|tensorflow|pytorch|scikit)\b/gi,
      /\b(biomedical|pcr|cytometry|fluidics|sensor|device|firmware|hardware)\b/gi,
      /\b(testing|automation|monitoring|analytics)\b/gi
    ];

    const allText = [
      ...tasks.map(t => t.title + ' ' + (t.description || '')),
      ...updates.map(u => u.messageText)
    ].join(' ');

    techPatterns.forEach(pattern => {
      const matches = allText.match(pattern);
      if (matches) {
        matches.forEach(match => techKeywords.add(match.toLowerCase()));
      }
    });

    return Array.from(techKeywords).slice(0, 8);
  }

  private analyzeProjectRelationships(projects: ProjectContext[], tasks: Task[]): { [projectId: string]: string[] } {
    const relationships: { [projectId: string]: string[] } = {};
    
    projects.forEach(project => {
      relationships[project.id] = [];
      
      // Find projects with shared team members
      projects.forEach(otherProject => {
        if (project.id !== otherProject.id) {
          const sharedMembers = project.teamMembers.filter(member => 
            otherProject.teamMembers.includes(member)
          );
          if (sharedMembers.length >= 2) {
            relationships[project.id].push(otherProject.id);
          }
        }
      });
      
      // Find projects with similar technologies
      projects.forEach(otherProject => {
        if (project.id !== otherProject.id && !relationships[project.id].includes(otherProject.id)) {
          const sharedTech = project.keyTechnologies.filter(tech => 
            otherProject.keyTechnologies.includes(tech)
          );
          if (sharedTech.length >= 2) {
            relationships[project.id].push(otherProject.id);
          }
        }
      });
    });

    return relationships;
  }

  private extractOverallPriorities(projects: ProjectContext[]): string[] {
    const priorityCount = projects.reduce((acc, p) => {
      acc[p.priority] = (acc[p.priority] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(priorityCount)
      .sort(([,a], [,b]) => b - a)
      .map(([priority]) => priority);
  }

  private identifyCrossProjectInitiatives(projects: ProjectContext[], tasks: Task[]): string[] {
    const initiatives: string[] = [];
    
    // Look for common themes in project goals
    const allGoals = projects.flatMap(p => p.goals);
    const goalFrequency = allGoals.reduce((acc, goal) => {
      const key = goal.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    Object.entries(goalFrequency)
      .filter(([, count]) => count >= 2)
      .forEach(([goal]) => initiatives.push(goal));

    return initiatives.slice(0, 5);
  }

  private identifyResourceConstraints(projects: ProjectContext[], employees: Employee[], tasks: Task[]): string[] {
    const constraints: string[] = [];
    
    // Check for overloaded team members
    const taskCounts = tasks.reduce((acc, task) => {
      if (task.status === 'in-progress') {
        acc[task.employeeId] = (acc[task.employeeId] || 0) + 1;
      }
      return acc;
    }, {} as { [employeeId: string]: number });

    const overloadedEmployees = Object.entries(taskCounts)
      .filter(([, count]) => count > 5)
      .map(([employeeId]) => employees.find(e => e.id === employeeId)?.displayName || employeeId);

    if (overloadedEmployees.length > 0) {
      constraints.push(`High workload: ${overloadedEmployees.slice(0, 3).join(', ')}`);
    }

    // Check for blocked tasks
    const blockedCount = tasks.filter(t => t.status === 'blocked').length;
    if (blockedCount > 0) {
      constraints.push(`${blockedCount} blocked tasks requiring attention`);
    }

    return constraints;
  }

  private findRecentCollaborations(employeeId: string, updates: WeeklyUpdate[], projects: ProjectContext[]): string[] {
    const collaborations: string[] = [];
    
    // Find projects where this employee recently collaborated
    const recentUpdates = updates
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    recentUpdates.forEach(update => {
      update.projects.forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (project && project.teamMembers.length > 1) {
          const otherMembers = project.teamMembers.filter(member => member !== employeeId);
          if (otherMembers.length > 0) {
            collaborations.push(`${project.name}: working with ${otherMembers.slice(0, 2).join(', ')}`);
          }
        }
      });
    });

    return [...new Set(collaborations)].slice(0, 3);
  }
}
