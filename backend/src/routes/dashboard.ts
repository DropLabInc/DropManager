import { Router } from 'express';
import { ProjectManager } from '../services/projectManager.js';
import { DashboardData, Analytics } from '../types/index.js';

const dashboardRouter = Router();

// Create a global project manager instance (in production, this would be injected)
let projectManagerInstance: ProjectManager | undefined;

export function setProjectManager(pm: ProjectManager) {
  projectManagerInstance = pm;
}

export function getProjectManager(): ProjectManager | undefined {
  return projectManagerInstance;
}

export { dashboardRouter };

// Dashboard overview endpoint
dashboardRouter.get('/overview', async (req, res) => {
  try {
    console.log('[DASHBOARD] /overview requested', { ts: new Date().toISOString() });
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    const counts = {
      updates: pm.getUpdates().length,
      tasks: pm.getTasks().length,
      projects: pm.getProjects().length,
      employees: pm.getEmployees().length,
    };
    console.log('[DASHBOARD] State counts before analytics', counts);

    const currentWeek = getCurrentWeek();
    const analytics = generateAnalytics(pm, currentWeek);
    const recentUpdates = pm
      .getUpdates()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const activeProjects = pm
      .getProjects()
      .filter((p) => p.status === 'active')
      .slice(0, 10);

    const upcomingDeadlines = pm
      .getTasks()
      .filter((t) => t.dueDate && t.status !== 'completed')
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 10);

    const employees = pm.getEmployees();
    const employeeStats = employees.map((employee) => {
      const stats = pm.getEmployeeStats(employee.id);
      return {
        employee,
        lastUpdate: getLastUpdateDate(employee.id, pm),
        tasksCompleted: stats.completed,
        tasksInProgress: stats.inProgress,
        tasksBlocked: stats.blocked,
      };
    });

    const dashboardData: DashboardData = {
      currentWeek,
      analytics,
      recentUpdates,
      activeProjects,
      upcomingDeadlines,
      employeeStats,
    };

    console.log('[DASHBOARD] Analytics summary', {
      weekOf: currentWeek,
      totalUpdates: analytics.totalUpdates,
      activeEmployees: analytics.activeEmployees,
      completedTasks: analytics.completedTasks,
      blockedTasks: analytics.blockedTasks,
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(dashboardData);
  } catch (error) {
    console.error('[DASHBOARD] Error generating overview:', error);
    res.status(500).json({ error: 'Failed to generate dashboard overview' });
  }
});

// Debug endpoint to inspect server-side state
dashboardRouter.get('/debug', (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(200).json({ ok: false, message: 'Project manager not initialized' });
    }
    const summary = projectManagerInstance.getStateSummary();
    return res.json({ ok: true, summary });
  } catch (e) {
    console.error('[DASHBOARD] /debug failed:', e);
    return res.status(500).json({ ok: false, error: 'debug_failed' });
  }
});

// Projects endpoint
dashboardRouter.get('/projects', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    const projects = pm.getProjects();
    const projectsWithStats = projects.map(project => ({
      ...project,
      stats: pm.getProjectStats(project.id)
    }));

    res.json(projectsWithStats);

  } catch (error) {
    console.error('[DASHBOARD] Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Employees endpoint
dashboardRouter.get('/employees', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    const employees = pm.getEmployees();
    const employeesWithStats = employees.map(employee => ({
      ...employee,
      stats: pm.getEmployeeStats(employee.id),
      lastUpdate: getLastUpdateDate(employee.id, pm)
    }));

    res.json(employeesWithStats);

  } catch (error) {
    console.error('[DASHBOARD] Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Tasks endpoint
dashboardRouter.get('/tasks', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const { status, employeeId, projectId, priority } = req.query;
    const pm = projectManagerInstance as ProjectManager;
    let tasks = pm.getTasks();

    // Apply filters
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    if (employeeId) {
      tasks = tasks.filter(t => t.employeeId === employeeId);
    }
    if (projectId) {
      tasks = tasks.filter(t => t.projectId === projectId);
    }
    if (priority) {
      tasks = tasks.filter(t => t.priority === priority);
    }

    // Sort by creation date (newest first)
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(tasks);

  } catch (error) {
    console.error('[DASHBOARD] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Enhanced messages endpoint with better filtering
dashboardRouter.get('/messages', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const { 
      employeeId, 
      projectId, 
      sentiment, 
      weekOf, 
      limit = '50', 
      offset = '0',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const pm = projectManagerInstance as ProjectManager;
    let updates = pm.getUpdates();

    // Apply filters
    if (employeeId) {
      updates = updates.filter(u => u.employeeId === employeeId);
    }
    if (projectId) {
      // Filter by messages that mention this project
      updates = updates.filter(u => u.projects.includes(projectId as string));
    }
    if (sentiment) {
      updates = updates.filter(u => u.sentiment === sentiment);
    }
    if (weekOf) {
      updates = updates.filter(u => u.weekOf === weekOf);
    }

    // Enhanced sorting
    updates.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'employee':
          comparison = a.employeeId.localeCompare(b.employeeId);
          break;
        case 'sentiment':
          comparison = (a.sentiment || 'neutral').localeCompare(b.sentiment || 'neutral');
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const total = updates.length;
    const paginatedUpdates = updates.slice(offsetNum, offsetNum + limitNum);

    // Enrich with employee and project info
    const employees = pm.getEmployees();
    const projects = pm.getProjects();
    const tasks = pm.getTasks();

    const enrichedUpdates = paginatedUpdates.map(update => {
      const employee = employees.find(e => e.id === update.employeeId);
      const relatedProjects = projects.filter(p => update.projects.includes(p.id));
      const relatedTasks = tasks.filter(t => 
        t.employeeId === update.employeeId && 
        update.projects.includes(t.projectId || '')
      );

      return {
        ...update,
        employee: employee ? {
          id: employee.id,
          displayName: employee.displayName,
          email: employee.email
        } : null,
        relatedProjects: relatedProjects.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority
        })),
        relatedTasks: relatedTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority
        })),
        // Add relative time for better UX
        relativeTime: getRelativeTime(update.createdAt)
      };
    });

    res.json({
      messages: enrichedUpdates,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      },
      filters: {
        employeeId,
        projectId,
        sentiment,
        weekOf
      },
      sorting: {
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('[DASHBOARD] Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Legacy updates endpoint (kept for backward compatibility)
dashboardRouter.get('/updates', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const { weekOf, employeeId, sentiment } = req.query;
    let updates = projectManagerInstance.getUpdates();

    // Apply filters
    if (weekOf) {
      updates = updates.filter(u => u.weekOf === weekOf);
    }
    if (employeeId) {
      updates = updates.filter(u => u.employeeId === employeeId);
    }
    if (sentiment) {
      updates = updates.filter(u => u.sentiment === sentiment);
    }

    // Sort by creation date (newest first)
    updates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(updates);

  } catch (error) {
    console.error('[DASHBOARD] Error fetching updates:', error);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Analytics endpoint with specific week
dashboardRouter.get('/analytics/:weekOf', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    const weekOf = req.params.weekOf;
    const analytics = generateAnalytics(pm, weekOf);

    res.json(analytics);

  } catch (error) {
    console.error('[DASHBOARD] Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Analytics endpoint for current week
dashboardRouter.get('/analytics', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    const weekOf = getCurrentWeek();
    const analytics = generateAnalytics(pm, weekOf);

    res.json(analytics);

  } catch (error) {
    console.error('[DASHBOARD] Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Reset endpoint for testing
dashboardRouter.post('/reset', async (req, res) => {
  try {
    if (!projectManagerInstance) {
      return res.status(500).json({ error: 'Project manager not initialized' });
    }

    const pm = projectManagerInstance as ProjectManager;
    pm.resetAllData();

    res.json({ 
      success: true, 
      message: 'All data has been reset',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DASHBOARD] Error resetting data:', error);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// Helper functions
function getCurrentWeek(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  now.setDate(now.getDate() - day);
  now.setHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}

function generateAnalytics(pm: ProjectManager, weekOf: string): Analytics {
  const updates = pm.getUpdates().filter(u => u.weekOf === weekOf);
  const tasks = pm.getTasks();
  const projects = pm.getProjects();
  const employees = pm.getEmployees();

  // Get unique employees who submitted updates this week
  const activeEmployeeIds = new Set(updates.map(u => u.employeeId));
  
  // Count completed tasks this week
  const completedTasks = tasks.filter(t => 
    t.status === 'completed' && 
    t.updatedAt >= weekOf && 
    t.updatedAt < getNextWeek(weekOf)
  ).length;

  // Count blocked tasks
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

  // Count projects with activity this week
  const projectsWithActivity = new Set(
    updates.flatMap(u => u.projects)
  ).size;

  // Calculate average tasks per employee
  const averageTasksPerEmployee = activeEmployeeIds.size > 0 
    ? Math.round((tasks.length / activeEmployeeIds.size) * 100) / 100 
    : 0;

  // Get top projects by task count
  const projectTaskCounts = new Map<string, number>();
  tasks.forEach(task => {
    if (task.projectId) {
      projectTaskCounts.set(task.projectId, (projectTaskCounts.get(task.projectId) || 0) + 1);
    }
  });

  const topProjects = Array.from(projectTaskCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([projectId, taskCount]) => ({ projectId, taskCount }));

  return {
    weekOf,
    totalUpdates: updates.length,
    activeEmployees: activeEmployeeIds.size,
    completedTasks,
    blockedTasks,
    projectsProgressed: projectsWithActivity,
    averageTasksPerEmployee,
    topProjects
  };
}

function getLastUpdateDate(employeeId: string, pm: ProjectManager): string | undefined {
  const employeeUpdates = pm.getUpdates()
    .filter(u => u.employeeId === employeeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return employeeUpdates.length > 0 ? employeeUpdates[0].createdAt : undefined;
}

function getNextWeek(weekOf: string): string {
  const date = new Date(weekOf);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
