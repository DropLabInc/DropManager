import express from 'express';
import { SummaryAgent } from '../agents/summaryAgent.js';
import { KnowledgeGapAgent } from '../agents/knowledgeGapAgent.js';
import { AnalysisCache } from '../services/analysisCache.js';

const analysisRouter = express.Router();

// Import ProjectManager instance (will be injected)
let projectManagerInstance: any = null;

export function setProjectManager(pm: any) {
  projectManagerInstance = pm;
}

export function getProjectManager() {
  return projectManagerInstance;
}

// Initialize agents (lazy loading)
let summaryAgent: SummaryAgent | null = null;
let knowledgeGapAgent: KnowledgeGapAgent | null = null;
let cache: AnalysisCache | null = null;

function initializeAgents() {
  if (!projectManagerInstance) {
    throw new Error('Project manager not initialized');
  }
  
  if (!cache) {
    cache = new AnalysisCache();
    console.log('[ANALYSIS] Cache initialized');
  }
  
  if (!summaryAgent) {
    summaryAgent = new SummaryAgent(projectManagerInstance);
    console.log('[ANALYSIS] SummaryAgent initialized');
  }
  
  if (!knowledgeGapAgent) {
    knowledgeGapAgent = new KnowledgeGapAgent(projectManagerInstance);
    console.log('[ANALYSIS] KnowledgeGapAgent initialized');
  }
}

// Summary Generation Endpoints

analysisRouter.get('/summary/project-status', async (req, res) => {
  try {
    initializeAgents();
    const { projectId } = req.query;
    
    const summary = await summaryAgent!.generateProjectStatusSummary(projectId as string);
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating project status summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate project status summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/summary/team-performance', async (req, res) => {
  try {
    initializeAgents();
    const { timeframe = 'week' } = req.query;
    
    const cacheKey = AnalysisCache.summaryKey('team-performance', timeframe as string);
    let summary = cache!.get(cacheKey);
    
    if (!summary) {
      console.log('[ANALYSIS] Cache miss - generating team performance summary...');
      summary = await summaryAgent!.generateTeamPerformanceSummary(timeframe as 'day' | 'week' | 'month');
      cache!.set(cacheKey, summary, 5 * 60 * 1000); // Cache for 5 minutes
    } else {
      console.log('[ANALYSIS] Cache hit - returning cached team performance summary');
    }
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString(),
      cached: cache!.has(cacheKey)
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating team performance summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate team performance summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/summary/weekly-highlights', async (req, res) => {
  try {
    initializeAgents();
    
    const cacheKey = AnalysisCache.summaryKey('weekly-highlights');
    let summary = cache!.get(cacheKey);
    
    if (!summary) {
      console.log('[ANALYSIS] Cache miss - generating weekly highlights...');
      summary = await summaryAgent!.generateWeeklyHighlights();
      cache!.set(cacheKey, summary, 5 * 60 * 1000); // Cache for 5 minutes
    } else {
      console.log('[ANALYSIS] Cache hit - returning cached weekly highlights');
    }
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString(),
      cached: cache!.has(cacheKey)
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating weekly highlights:', error);
    res.status(500).json({ 
      error: 'Failed to generate weekly highlights',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/summary/risk-alerts', async (req, res) => {
  try {
    initializeAgents();
    
    const cacheKey = AnalysisCache.summaryKey('risk-alerts');
    let summary = cache!.get(cacheKey);
    
    if (!summary) {
      console.log('[ANALYSIS] Cache miss - generating risk alerts...');
      summary = await summaryAgent!.generateRiskAlerts();
      cache!.set(cacheKey, summary, 5 * 60 * 1000); // Cache for 5 minutes
    } else {
      console.log('[ANALYSIS] Cache hit - returning cached risk alerts');
    }
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString(),
      cached: cache!.has(cacheKey)
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating risk alerts:', error);
    res.status(500).json({ 
      error: 'Failed to generate risk alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/summary/executive-brief', async (req, res) => {
  try {
    initializeAgents();
    
    const summary = await summaryAgent!.generateExecutiveBrief();
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating executive brief:', error);
    res.status(500).json({ 
      error: 'Failed to generate executive brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Custom summary with parameters
analysisRouter.post('/summary/custom', async (req, res) => {
  try {
    initializeAgents();
    const { type, timeframe, projectId, employeeId, priority } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Summary type is required' });
    }
    
    const summary = await summaryAgent!.generateSummary({
      type,
      timeframe,
      projectId,
      employeeId,
      priority
    });
    
    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating custom summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate custom summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Knowledge Gap Analysis Endpoints

analysisRouter.get('/gaps/analyze', async (req, res) => {
  try {
    initializeAgents();
    const { scope, projectId, employeeId, timeframe, minSeverity } = req.query;
    
    const cacheKey = AnalysisCache.gapsKey(projectId as string || employeeId as string);
    let analysis = cache!.get(cacheKey);
    
    if (!analysis) {
      console.log('[ANALYSIS] Cache miss - analyzing knowledge gaps...');
      analysis = await knowledgeGapAgent!.analyzeKnowledgeGaps({
        scope: scope as 'all' | 'project' | 'employee',
        projectId: projectId as string,
        employeeId: employeeId as string,
        timeframe: timeframe as 'day' | 'week' | 'month',
        minSeverity: minSeverity as 'low' | 'medium' | 'high' | 'critical'
      });
      cache!.set(cacheKey, analysis, 5 * 60 * 1000); // Cache for 5 minutes
    } else {
      console.log('[ANALYSIS] Cache hit - returning cached knowledge gaps analysis');
    }
    
    res.json({
      success: true,
      analysis,
      analyzedAt: new Date().toISOString(),
      cached: cache!.has(cacheKey)
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error analyzing knowledge gaps:', error);
    res.status(500).json({ 
      error: 'Failed to analyze knowledge gaps',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/gaps/critical', async (req, res) => {
  try {
    initializeAgents();
    
    const criticalGaps = await knowledgeGapAgent!.findCriticalGaps();
    
    res.json({
      success: true,
      gaps: criticalGaps,
      count: criticalGaps.length,
      analyzedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error finding critical gaps:', error);
    res.status(500).json({ 
      error: 'Failed to find critical gaps',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/questions/employee/:employeeId', async (req, res) => {
  try {
    initializeAgents();
    const { employeeId } = req.params;
    
    const questions = await knowledgeGapAgent!.generateQuestionsForEmployee(employeeId);
    
    res.json({
      success: true,
      questions,
      count: questions.length,
      employeeId,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating questions for employee:', error);
    res.status(500).json({ 
      error: 'Failed to generate questions for employee',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

analysisRouter.get('/questions/project/:projectId', async (req, res) => {
  try {
    initializeAgents();
    const { projectId } = req.params;
    
    const questions = await knowledgeGapAgent!.generateQuestionsForProject(projectId);
    
    res.json({
      success: true,
      questions,
      count: questions.length,
      projectId,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating questions for project:', error);
    res.status(500).json({ 
      error: 'Failed to generate questions for project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comprehensive analysis endpoint
analysisRouter.get('/comprehensive', async (req, res) => {
  try {
    initializeAgents();
    const { timeframe = 'week' } = req.query;
    
    console.log('[ANALYSIS] Starting comprehensive analysis...');
    
    // Generate multiple summaries and gap analysis in parallel
    const [
      projectStatus,
      teamPerformance,
      weeklyHighlights,
      riskAlerts,
      gapAnalysis
    ] = await Promise.all([
      summaryAgent!.generateProjectStatusSummary(),
      summaryAgent!.generateTeamPerformanceSummary(timeframe as 'day' | 'week' | 'month'),
      summaryAgent!.generateWeeklyHighlights(),
      summaryAgent!.generateRiskAlerts(),
      knowledgeGapAgent!.analyzeKnowledgeGaps({ timeframe: timeframe as 'day' | 'week' | 'month' })
    ]);
    
    const comprehensiveReport = {
      summaries: {
        projectStatus,
        teamPerformance,
        weeklyHighlights,
        riskAlerts
      },
      knowledgeGaps: {
        gaps: gapAnalysis.gaps,
        questions: gapAnalysis.questions,
        summary: gapAnalysis.summary
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        timeframe,
        totalSummaries: 4,
        totalGaps: gapAnalysis.gaps.length,
        totalQuestions: gapAnalysis.questions.length,
        criticalIssues: gapAnalysis.gaps.filter(g => g.severity === 'critical').length,
        urgentQuestions: gapAnalysis.questions.filter(q => q.priority === 'urgent').length
      }
    };
    
    console.log('[ANALYSIS] Comprehensive analysis complete:', {
      summaries: 4,
      gaps: gapAnalysis.gaps.length,
      questions: gapAnalysis.questions.length
    });
    
    res.json({
      success: true,
      report: comprehensiveReport
    });
    
  } catch (error) {
    console.error('[ANALYSIS] Error generating comprehensive analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate comprehensive analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
analysisRouter.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    agents: {
      summaryAgent: summaryAgent !== null,
      knowledgeGapAgent: knowledgeGapAgent !== null
    },
    projectManager: projectManagerInstance !== null,
    timestamp: new Date().toISOString()
  };
  
  res.json(health);
});

// Cache Management Endpoints

analysisRouter.get('/cache/stats', (req, res) => {
  try {
    initializeAgents();
    const stats = cache!.getStats();
    
    res.json({
      success: true,
      stats,
      message: `Cache contains ${stats.size} entries`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

analysisRouter.post('/cache/clear', (req, res) => {
  try {
    initializeAgents();
    cache!.clear();
    
    res.json({
      success: true,
      message: 'Analysis cache cleared successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default analysisRouter;
