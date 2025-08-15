// Core data types for the project management system

export interface Employee {
  id: string;
  email: string;
  displayName: string;
  department?: string;
  manager?: string;
  isActive: boolean;
  createdAt: string;
  lastUpdateAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  assignedEmployees: string[]; // Employee IDs
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId?: string;
  employeeId: string;
  title: string;
  description?: string;
  status: 'not-started' | 'in-progress' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  completedDate?: string;
  blockers?: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyUpdate {
  id: string;
  employeeId: string;
  weekOf: string; // YYYY-MM-DD (Monday)
  messageText: string;
  extractedTasks: Task[];
  projects: string[]; // Project IDs mentioned
  sentiment: 'positive' | 'neutral' | 'negative' | 'blocked';
  hasImages: boolean;
  imageCount: number;
  imageAnalyses?: Array<{ filename?: string; summary: string; extractedText?: string; tags?: string[] }>;
  chatMetadata: {
    spaceName: string;
    threadName: string;
    messageName: string;
    spaceType: string;
  };
  createdAt: string;
  processedAt?: string;
}

export interface Reminder {
  id: string;
  employeeId: string;
  type: 'weekly-update' | 'overdue-task' | 'project-deadline';
  message: string;
  scheduledFor: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  metadata?: any;
  createdAt: string;
}

export interface Analytics {
  weekOf: string;
  totalUpdates: number;
  activeEmployees: number;
  completedTasks: number;
  blockedTasks: number;
  projectsProgressed: number;
  averageTasksPerEmployee: number;
  topProjects: Array<{ projectId: string; taskCount: number; }>;
  departmentStats?: Array<{ department: string; updateCount: number; }>;
}

// API Request/Response types
export interface ProcessUpdateRequest {
  messageText: string;
  employeeId: string;
  employeeEmail: string;
  employeeDisplayName: string;
  weekOf: string;
  hasImages: boolean;
  imageCount: number;
  images?: Array<{ filename?: string; mimeType: string; dataBase64: string; size?: number }>;
  chatMetadata: {
    spaceName: string;
    threadName: string;
    messageName: string;
    spaceType: string;
  };
}

export interface ProcessUpdateResponse {
  success: boolean;
  updateId: string;
  extractedTasks: Task[];
  assignedProjects: string[];
  message: string;
  imageAnalyses?: Array<{ filename?: string; summary: string; extractedText?: string; tags?: string[] }>;
}

export interface DashboardData {
  currentWeek: string;
  analytics: Analytics;
  recentUpdates: WeeklyUpdate[];
  activeProjects: Project[];
  upcomingDeadlines: Task[];
  employeeStats: Array<{
    employee: Employee;
    lastUpdate?: string;
    tasksCompleted: number;
    tasksInProgress: number;
    tasksBlocked: number;
  }>;
}

