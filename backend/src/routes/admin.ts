import { Router } from 'express'

export const adminRouter = Router()

adminRouter.get('/health', (_req, res) => {
res.json({ ok: true, role: 'admin' })
})

adminRouter.get('/', (_req, res) => {
const uiVersion = process.env.ADMIN_UI_VERSION || (process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : '') || 'dev'
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0"/>
<meta http-equiv="Pragma" content="no-cache"/>
<meta http-equiv="Expires" content="0"/>
<title>DropManager Admin Dashboard</title>
<style>
  :root { --bg: #0b1220; --panel: #121a2b; --muted: #97a3b6; --text: #e8eefc; --accent: #5b8cff; --ok:#22c55e; --warn:#f59e0b; --bad:#ef4444; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
  a { color: var(--accent); text-decoration: none; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 0.3px; }
  .controls { display:flex; gap:8px; align-items:center; }
  .btn { background: var(--accent); color:#fff; border:0; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
  .btn.secondary { background:#1e293b; color:#dbeafe; border:1px solid #334155; }
  .grid { display:grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 900px){ .grid { grid-template-columns: 1.2fr 1fr; } }
  .panel { background: var(--panel); border:1px solid #1f2a44; border-radius: 12px; padding: 14px; }
  .panel h2 { margin:0 0 10px 0; font-size: 15px; color:#dbeafe; }
  .kpis { display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .kpi { background:#0e1627; border:1px solid #1f2a44; padding:10px; border-radius:10px; }
  .kpi .label { color: var(--muted); font-size: 11px; }
  .kpi .value { font-weight: 700; font-size: 18px; margin-top: 2px; }
  .muted { color: var(--muted); }
  table { width:100%; border-collapse: collapse; }
  th, td { text-align:left; border-bottom: 1px solid #1f2a44; padding:8px 6px; font-size: 13px; }
  th { color:#c7d2fe; font-weight:600; }
  .tag { display:inline-block; background:#0e1627; border:1px solid #1f2a44; padding:2px 6px; border-radius:999px; font-size:11px; margin-right:4px; }
  .status { font-weight:600; }
  .status.completed { color: var(--ok); }
  .status[ data-status="blocked" ] { color: var(--bad); }
  .status[ data-status="in-progress" ] { color: #60a5fa; }
  .status[ data-status="not-started" ] { color: var(--muted); }
  .pill { padding:2px 8px; border-radius:999px; border:1px solid #1f2a44; background:#0e1627; font-size:11px; }
  .error { color: var(--bad); font-weight:600; }
  .ok { color: var(--ok); font-weight:600; }
  .section-actions { display:flex; gap:8px; align-items:center; }
  .sr { position:absolute; left:-9999px; }
  footer { margin-top:16px; color:var(--muted); font-size:12px; text-align:center; }
  .version { color: var(--muted); font-weight: 600; }
</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>DropManager — Admin Dashboard <span class="version" id="uiVersion"></span></h1>
      <div class="controls">
        <button id="refresh" class="btn">Refresh</button>
        <span id="lastRefreshed" class="muted"></span>
      </div>
    </header>

    <div class="panel">
      <div class="kpis" id="kpis">
        <div class="kpi"><div class="label">Total Updates</div><div class="value" id="kpiTotalUpdates">—</div></div>
        <div class="kpi"><div class="label">Active Employees</div><div class="value" id="kpiActiveEmployees">—</div></div>
        <div class="kpi"><div class="label">Completed Tasks</div><div class="value" id="kpiCompletedTasks">—</div></div>
        <div class="kpi"><div class="label">Blocked Tasks</div><div class="value" id="kpiBlockedTasks">—</div></div>
        <div class="kpi"><div class="label">Projects Progressed</div><div class="value" id="kpiProjects">—</div></div>
      </div>
      <div class="muted" style="margin-top:6px">
        Current week: <span id="currentWeek">—</span> • Avg tasks/employee: <span id="avgTasks">—</span>
      </div>
    </div>

    <div class="grid">
      <section class="panel" id="recentUpdatesPanel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <h2>Recent Updates</h2>
          <div class="section-actions">
            <button class="btn secondary" id="copyOverview">Copy Summary</button>
          </div>
        </div>
        <div id="recentUpdates" class="muted">Loading…</div>
      </section>

      <section class="panel">
        <h2>Top Projects</h2>
        <table>
          <thead>
            <tr><th>Project</th><th>Tasks</th></tr>
          </thead>
          <tbody id="topProjects"><tr><td colspan="2" class="muted">Loading…</td></tr></tbody>
        </table>
      </section>
    </div>

    <div class="grid">
      <section class="panel">
        <h2>Active Projects</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Priority</th><th>Tags</th></tr>
          </thead>
          <tbody id="activeProjects"><tr><td colspan="4" class="muted">Loading…</td></tr></tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Upcoming Deadlines</h2>
        <table>
          <thead>
            <tr><th>Task</th><th>Due</th><th>Assignee</th><th>Status</th></tr>
          </thead>
          <tbody id="upcomingDeadlines"><tr><td colspan="4" class="muted">Loading…</td></tr></tbody>
        </table>
      </section>
    </div>

    <section class="panel">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h2>Debug</h2>
        <div class="section-actions">
          <button class="btn secondary" id="refreshDebug">Refresh Debug</button>
        </div>
      </div>
      <div class="muted" style="margin-bottom:8px;">Project Manager state and server info.</div>
      <pre id="debugInfo" class="muted" style="white-space:pre-wrap; overflow:auto; max-height:220px;">Loading…</pre>
    </section>

          <section class="panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <h2>Messages</h2>
          <div class="section-actions">
            <select id="filterEmployee" class="btn secondary" style="padding:4px 8px;">
              <option value="">All Employees</option>
            </select>
            <select id="filterProject" class="btn secondary" style="padding:4px 8px;">
              <option value="">All Projects</option>
            </select>
            <select id="filterSentiment" class="btn secondary" style="padding:4px 8px;">
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
            <button class="btn secondary" id="refreshMessages">Refresh</button>
          </div>
        </div>
        <div class="muted" style="margin-bottom:8px;">
          Showing <span id="messageCount">0</span> messages • <span id="messageFilters">No filters</span>
        </div>
        <div id="messagesList" style="max-height:400px;overflow-y:auto;">
          <div class="muted">Loading messages...</div>
        </div>
        <div style="margin-top:8px;text-align:center;">
          <button class="btn secondary" id="loadMoreMessages" style="display:none;">Load More</button>
        </div>
      </section>

      <section class="panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <h2>📊 AI Analysis Reports</h2>
          <div class="section-actions">
            <button class="btn secondary" id="refreshAnalysis">Refresh Reports</button>
          </div>
        </div>
        <div class="muted" style="margin-bottom:12px;">
          AI-powered insights and summaries generated from team messages
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="background:#0e1627;border:1px solid #1f2a44;padding:12px;border-radius:8px;">
            <div style="font-weight:600;color:#dbeafe;margin-bottom:8px;">📋 Weekly Highlights</div>
            <div id="weeklyHighlights" class="muted" style="font-size:12px;">Loading...</div>
            <div style="margin-top:8px;">
              <button class="btn secondary" id="viewWeeklyHighlights" style="padding:4px 8px;font-size:11px;">View Details</button>
            </div>
          </div>
          <div style="background:#0e1627;border:1px solid #1f2a44;padding:12px;border-radius:8px;">
            <div style="font-weight:600;color:#dbeafe;margin-bottom:8px;">🚨 Risk Alerts</div>
            <div id="riskAlerts" class="muted" style="font-size:12px;">Loading...</div>
            <div style="margin-top:8px;">
              <button class="btn secondary" id="viewRiskAlerts" style="padding:4px 8px;font-size:11px;">View Details</button>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="background:#0e1627;border:1px solid #1f2a44;padding:12px;border-radius:8px;">
            <div style="font-weight:600;color:#dbeafe;margin-bottom:8px;">🔍 Knowledge Gaps</div>
            <div id="knowledgeGaps" class="muted" style="font-size:12px;">Loading...</div>
            <div style="margin-top:8px;">
              <button class="btn secondary" id="viewKnowledgeGaps" style="padding:4px 8px;font-size:11px;">View Details</button>
            </div>
          </div>
          <div style="background:#0e1627;border:1px solid #1f2a44;padding:12px;border-radius:8px;">
            <div style="font-weight:600;color:#dbeafe;margin-bottom:8px;">👥 Team Performance</div>
            <div id="teamPerformance" class="muted" style="font-size:12px;">Loading...</div>
            <div style="margin-top:8px;">
              <button class="btn secondary" id="viewTeamPerformance" style="padding:4px 8px;font-size:11px;">View Details</button>
            </div>
          </div>
        </div>
      </section>

    <section class="panel">
      <h2>Employees</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Last Update</th><th>Completed</th><th>In Progress</th><th>Blocked</th></tr>
        </thead>
        <tbody id="employeeStats"><tr><td colspan="6" class="muted">Loading…</td></tr></tbody>
      </table>
    </section>

    <footer>DropManager Admin • <span class="muted" id="footerVersion">v</span></footer>
  </div>

<script>
const UI_VERSION = ${JSON.stringify('${uiVersion}')};
console.log('[ADMIN] UI boot', { version: UI_VERSION, ts: new Date().toISOString() });

async function fetchJSON(path){
  const res = await fetch(path, { headers: { 'Accept':'application/json' }, cache: 'no-store' });
  if(!res.ok) throw new Error('Request failed: '+res.status);
  return await res.json();
}

function escapeHtml(s){
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return (s||'').toString().replace(/[&<>"']/g, function(c){
    if (c === "'") return '&#39;';
    return map[c] || c;
  });
}

function fmtDate(d){ try { return new Date(d).toLocaleString(); } catch { return d || '—'; } }

function renderOverview(data){
  document.getElementById('kpiTotalUpdates').textContent = data.analytics.totalUpdates ?? '0';
  document.getElementById('kpiActiveEmployees').textContent = data.analytics.activeEmployees ?? '0';
  document.getElementById('kpiCompletedTasks').textContent = data.analytics.completedTasks ?? '0';
  document.getElementById('kpiBlockedTasks').textContent = data.analytics.blockedTasks ?? '0';
  document.getElementById('kpiProjects').textContent = data.analytics.projectsProgressed ?? '0';
  document.getElementById('currentWeek').textContent = data.currentWeek || '—';
  document.getElementById('avgTasks').textContent = data.analytics.averageTasksPerEmployee ?? '0';

  const recent = data.recentUpdates || [];
  const updatesHtml = recent.length ? recent.map(u => {
    const s = escapeHtml(u.messageText || '').slice(0, 240);
    const pill = '<span class="pill">'+(u.sentiment||'neutral')+'</span>';
    return '<div style="padding:8px 0;border-bottom:1px solid #1f2a44;">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;">' +
        '<div><strong>' + escapeHtml(u.employeeId) + '</strong> • ' + pill + '</div>' +
        '<div class="muted">' + fmtDate(u.createdAt) + '</div>' +
      '</div>' +
      '<div class="muted" style="margin-top:4px;">' + s + '</div>' +
    '</div>';
  }).join('') : '<div class="muted">No recent updates.</div>';
  document.getElementById('recentUpdates').innerHTML = updatesHtml;

  const tp = data.analytics.topProjects || [];
  document.getElementById('topProjects').innerHTML = tp.length ? tp.map(p => '<tr><td>' + escapeHtml(p.projectId) + '</td><td>' + p.taskCount + '</td></tr>').join('') : '<tr><td colspan="2" class="muted">No data</td></tr>';

  const act = data.activeProjects || [];
  document.getElementById('activeProjects').innerHTML = act.length ? act.map(p => '<tr>' +
    '<td>' + escapeHtml(p.name) + '</td>' +
    '<td><span class="pill">' + escapeHtml(p.status) + '</span></td>' +
    '<td><span class="pill">' + escapeHtml(p.priority) + '</span></td>' +
    '<td>' + (p.tags||[]).map(t=>'<span class="tag">' + escapeHtml(t) + '</span>').join('') + '</td>' +
  '</tr>').join('') : '<tr><td colspan="4" class="muted">No active projects</td></tr>';

  const deadlines = data.upcomingDeadlines || [];
  document.getElementById('upcomingDeadlines').innerHTML = deadlines.length ? deadlines.map(t => '<tr>' +
    '<td>' + escapeHtml(t.title) + '</td>' +
    '<td>' + escapeHtml(t.dueDate||'—') + '</td>' +
    '<td>' + escapeHtml(t.employeeId||'—') + '</td>' +
    '<td><span class="status" data-status="' + escapeHtml(t.status) + '">' + escapeHtml(t.status) + '</span></td>' +
  '</tr>').join('') : '<tr><td colspan="4" class="muted">No upcoming deadlines</td></tr>';

  const estats = data.employeeStats || [];
  document.getElementById('employeeStats').innerHTML = estats.length ? estats.map(e => '<tr>' +
    '<td>' + escapeHtml(e.employee.displayName || e.employee.id) + '</td>' +
    '<td class="muted">' + escapeHtml(e.employee.email||'') + '</td>' +
    '<td>' + escapeHtml(e.lastUpdate||'—') + '</td>' +
    '<td>' + (e.tasksCompleted||0) + '</td>' +
    '<td>' + (e.tasksInProgress||0) + '</td>' +
    '<td>' + (e.tasksBlocked||0) + '</td>' +
  '</tr>').join('') : '<tr><td colspan="6" class="muted">No employees</td></tr>';
}

async function refreshAll(){
  try{
    const tsParam = 'ts=' + Date.now();
    console.log('[ADMIN] Fetching overview...');
    const data = await fetchJSON('/dashboard/overview?' + tsParam);
    console.log('[ADMIN] Overview loaded', {
      analytics: data && data.analytics ? data.analytics : null,
      recentUpdates: (data && data.recentUpdates ? data.recentUpdates.length : 0),
      activeProjects: (data && data.activeProjects ? data.activeProjects.length : 0),
      upcomingDeadlines: (data && data.upcomingDeadlines ? data.upcomingDeadlines.length : 0),
      employeeStats: (data && data.employeeStats ? data.employeeStats.length : 0),
    });
    renderOverview(data);
    const ts = new Date();
    document.getElementById('lastRefreshed').textContent = 'Updated ' + ts.toLocaleTimeString();
    await refreshDebug();
  } catch (e){
    console.error('[ADMIN] Failed to load overview', e);
    document.getElementById('recentUpdates').innerHTML = '<span class="error">Failed to load. Check server logs.</span>';
  }
}

document.getElementById('refresh').addEventListener('click', refreshAll);
document.getElementById('copyOverview').addEventListener('click', async () => {
  const text = document.querySelector('#recentUpdatesPanel').innerText || '';
  try { await navigator.clipboard.writeText(text); } catch {}
});

async function refreshDebug(){
  try{
    const tsParam = 'ts=' + Date.now();
    console.log('[ADMIN] Fetching debug...');
    const dbg = await fetchJSON('/dashboard/debug?' + tsParam);
    document.getElementById('debugInfo').textContent = JSON.stringify(dbg, null, 2);
  } catch (e){
    console.error('[ADMIN] Failed to load debug', e);
    document.getElementById('debugInfo').textContent = 'Failed to load debug info.';
  }
}

document.getElementById('refreshDebug').addEventListener('click', refreshDebug);
document.getElementById('uiVersion').textContent = 'v' + UI_VERSION;
document.getElementById('footerVersion').textContent = 'v' + UI_VERSION;

// Messages functionality
let messagesOffset = 0;
let messagesData = null;

async function loadMessages(reset = false) {
  try {
    if (reset) messagesOffset = 0;
    
    const employeeFilter = document.getElementById('filterEmployee').value;
    const projectFilter = document.getElementById('filterProject').value;
    const sentimentFilter = document.getElementById('filterSentiment').value;
    
    const params = new URLSearchParams({
      limit: '20',
      offset: messagesOffset.toString(),
      sortBy: 'date',
      sortOrder: 'desc'
    });
    
    if (employeeFilter) params.append('employeeId', employeeFilter);
    if (projectFilter) params.append('projectId', projectFilter);
    if (sentimentFilter) params.append('sentiment', sentimentFilter);
    
    const response = await fetchJSON('/dashboard/messages?' + params);
    messagesData = response;
    
    renderMessages(response, reset);
    updateMessageFilters();
    
  } catch (error) {
    console.error('[ADMIN] Failed to load messages:', error);
    document.getElementById('messagesList').innerHTML = '<div class="error">Failed to load messages</div>';
  }
}

function renderMessages(data, reset = false) {
  const container = document.getElementById('messagesList');
  const messages = data.messages || [];
  
  const messagesHtml = messages.map(msg => {
    const employee = msg.employee || { displayName: msg.employeeId, email: '' };
    const projects = (msg.relatedProjects || []).map(p => 
      '<span class="tag">' + escapeHtml(p.name) + '</span>'
    ).join('');
    
    const tasks = (msg.relatedTasks || []).slice(0, 3).map(t => 
      '<span class="pill" style="margin-right:4px;">' + escapeHtml(t.title) + '</span>'
    ).join('');
    
    const sentimentColor = {
      positive: 'var(--ok)',
      negative: 'var(--bad)', 
      neutral: 'var(--muted)'
    }[msg.sentiment] || 'var(--muted)';
    
    return '<div style="border-bottom:1px solid #1f2a44;padding:12px 0;">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:6px;">' +
        '<div>' +
          '<strong>' + escapeHtml(employee.displayName) + '</strong>' +
          '<span class="muted" style="margin-left:8px;">' + escapeHtml(employee.email) + '</span>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="color:' + sentimentColor + ';font-size:11px;font-weight:600;">' + (msg.sentiment || 'neutral') + '</div>' +
          '<div class="muted" style="font-size:11px;">' + (msg.relativeTime || fmtDate(msg.createdAt)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:6px;">' + escapeHtml(msg.messageText).slice(0, 300) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
        '<span class="muted" style="font-size:11px;">Projects:</span>' + projects +
        (tasks ? '<span class="muted" style="font-size:11px;margin-left:8px;">Tasks:</span>' + tasks : '') +
      '</div>' +
    '</div>';
  }).join('');
  
  if (reset) {
    container.innerHTML = messagesHtml || '<div class="muted">No messages found</div>';
  } else {
    container.innerHTML += messagesHtml;
  }
  
  // Update load more button
  const loadMoreBtn = document.getElementById('loadMoreMessages');
  if (data.pagination && data.pagination.hasMore) {
    loadMoreBtn.style.display = 'inline-block';
    messagesOffset += messages.length;
  } else {
    loadMoreBtn.style.display = 'none';
  }
  
  document.getElementById('messageCount').textContent = data.pagination ? data.pagination.total : messages.length;
}

function updateMessageFilters() {
  const filters = [];
  const employeeFilter = document.getElementById('filterEmployee').value;
  const projectFilter = document.getElementById('filterProject').value;
  const sentimentFilter = document.getElementById('filterSentiment').value;
  
  if (employeeFilter) filters.push('Employee: ' + employeeFilter);
  if (projectFilter) filters.push('Project: ' + projectFilter);
  if (sentimentFilter) filters.push('Sentiment: ' + sentimentFilter);
  
  document.getElementById('messageFilters').textContent = filters.length ? filters.join(', ') : 'No filters';
}

async function populateMessageFilters() {
  try {
    // Load employees for filter dropdown
    const employees = await fetchJSON('/dashboard/employees');
    const employeeSelect = document.getElementById('filterEmployee');
    employeeSelect.innerHTML = '<option value="">All Employees</option>' +
      employees.map(emp => '<option value="' + escapeHtml(emp.id) + '">' + escapeHtml(emp.displayName || emp.id) + '</option>').join('');
    
    // Load projects for filter dropdown
    const projects = await fetchJSON('/dashboard/projects');
    const projectSelect = document.getElementById('filterProject');
    projectSelect.innerHTML = '<option value="">All Projects</option>' +
      projects.map(proj => '<option value="' + escapeHtml(proj.id) + '">' + escapeHtml(proj.name) + '</option>').join('');
      
  } catch (error) {
    console.error('[ADMIN] Failed to populate filters:', error);
  }
}

// Event listeners for messages
document.getElementById('refreshMessages').addEventListener('click', () => loadMessages(true));
document.getElementById('loadMoreMessages').addEventListener('click', () => loadMessages(false));
document.getElementById('filterEmployee').addEventListener('change', () => loadMessages(true));
document.getElementById('filterProject').addEventListener('change', () => loadMessages(true));
document.getElementById('filterSentiment').addEventListener('change', () => loadMessages(true));

// Analysis Reports functionality
async function loadAnalysisReports() {
  try {
    console.log('[ADMIN] Loading analysis reports...');
    
    // Load Weekly Highlights
    const highlightsResponse = await fetchJSON('/analysis/summary/weekly-highlights');
    const highlights = highlightsResponse.summary;
    document.getElementById('weeklyHighlights').innerHTML = 
      '<strong>' + highlights.title + '</strong><br/>' +
      '<div class="muted" style="margin-top:4px;">Confidence: ' + highlights.confidence + '% • ' + highlights.highlights.length + ' highlights</div>' +
      '<div style="margin-top:6px;">' + highlights.highlights.slice(0, 2).map(h => '• ' + h.substring(0, 80) + '...').join('<br/>') + '</div>';
    
    // Load Risk Alerts
    const riskResponse = await fetchJSON('/analysis/summary/risk-alerts');
    const risks = riskResponse.summary;
    document.getElementById('riskAlerts').innerHTML = 
      '<strong>' + risks.title + '</strong><br/>' +
      '<div class="muted" style="margin-top:4px;">Confidence: ' + risks.confidence + '% • ' + risks.concerns.length + ' concerns</div>' +
      '<div style="margin-top:6px;">' + risks.concerns.slice(0, 2).map(c => '⚠️ ' + c.substring(0, 80) + '...').join('<br/>') + '</div>';
    
    // Load Knowledge Gaps
    const gapsResponse = await fetchJSON('/analysis/gaps/analyze');
    const gaps = gapsResponse.analysis;
    document.getElementById('knowledgeGaps').innerHTML = 
      '<strong>' + gaps.gaps.length + ' gaps identified</strong><br/>' +
      '<div class="muted" style="margin-top:4px;">Critical: ' + gaps.summary.criticalGaps + ' • High: ' + gaps.summary.highPriorityGaps + '</div>' +
      '<div style="margin-top:6px;">' + gaps.gaps.slice(0, 2).map(g => '🔍 ' + g.type + ' (' + g.severity + '): ' + g.description.substring(0, 60) + '...').join('<br/>') + '</div>';
    
    // Load Team Performance
    const teamResponse = await fetchJSON('/analysis/summary/team-performance');
    const team = teamResponse.summary;
    document.getElementById('teamPerformance').innerHTML = 
      '<strong>' + team.title + '</strong><br/>' +
      '<div class="muted" style="margin-top:4px;">Confidence: ' + team.confidence + '% • ' + team.keyMetrics.length + ' metrics</div>' +
      '<div style="margin-top:6px;">' + team.keyMetrics.slice(0, 2).map(m => '📊 ' + m.label + ': ' + m.value).join('<br/>') + '</div>';
      
    console.log('[ADMIN] Analysis reports loaded successfully');
    
  } catch (error) {
    console.error('[ADMIN] Failed to load analysis reports:', error);
    document.getElementById('weeklyHighlights').innerHTML = '<div class="error">Failed to load highlights</div>';
    document.getElementById('riskAlerts').innerHTML = '<div class="error">Failed to load risk alerts</div>';
    document.getElementById('knowledgeGaps').innerHTML = '<div class="error">Failed to load knowledge gaps</div>';
    document.getElementById('teamPerformance').innerHTML = '<div class="error">Failed to load team performance</div>';
  }
}

async function showDetailedReport(type) {
  try {
    let response, title, content;
    
    switch(type) {
      case 'highlights':
        response = await fetchJSON('/analysis/summary/weekly-highlights');
        title = 'Weekly Highlights';
        content = formatDetailedSummary(response.summary);
        break;
      case 'risks':
        response = await fetchJSON('/analysis/summary/risk-alerts');
        title = 'Risk Alerts';
        content = formatDetailedSummary(response.summary);
        break;
      case 'gaps':
        response = await fetchJSON('/analysis/gaps/analyze');
        title = 'Knowledge Gaps';
        content = formatDetailedGaps(response.analysis);
        break;
      case 'team':
        response = await fetchJSON('/analysis/summary/team-performance');
        title = 'Team Performance';
        content = formatDetailedSummary(response.summary);
        break;
    }
    
    // Create modal-like display (simple alert for now, could be enhanced)
    alert(title + '\\n\\n' + content);
    
  } catch (error) {
    alert('Failed to load detailed ' + type + ' report: ' + error.message);
  }
}

function formatDetailedSummary(summary) {
  let content = summary.title + '\\nConfidence: ' + summary.confidence + '%\\n\\n';
  
  if (summary.highlights?.length > 0) {
    content += 'HIGHLIGHTS:\\n';
    summary.highlights.forEach((h, i) => content += (i+1) + '. ' + h + '\\n');
    content += '\\n';
  }
  
  if (summary.concerns?.length > 0) {
    content += 'CONCERNS:\\n';
    summary.concerns.forEach((c, i) => content += (i+1) + '. ' + c + '\\n');
    content += '\\n';
  }
  
  if (summary.recommendations?.length > 0) {
    content += 'RECOMMENDATIONS:\\n';
    summary.recommendations.forEach((r, i) => content += (i+1) + '. ' + r + '\\n');
  }
  
  return content;
}

function formatDetailedGaps(analysis) {
  let content = 'Found ' + analysis.gaps.length + ' knowledge gaps\\n';
  content += 'Critical: ' + analysis.summary.criticalGaps + ', High: ' + analysis.summary.highPriorityGaps + '\\n\\n';
  
  content += 'TOP GAPS:\\n';
  analysis.gaps.slice(0, 5).forEach((gap, i) => {
    content += (i+1) + '. [' + gap.severity.toUpperCase() + '] ' + gap.type + '\\n';
    content += '   ' + gap.description + '\\n\\n';
  });
  
  if (analysis.questions.length > 0) {
    content += 'GENERATED QUESTIONS (' + analysis.questions.length + '):';
    analysis.questions.slice(0, 3).forEach((q, i) => {
      content += (i+1) + '. For ' + q.targetEmployeeName + ': ' + q.question + '\\n\\n';
    });
  }
  
  return content;
}

// Event listeners for analysis reports
document.getElementById('refreshAnalysis').addEventListener('click', loadAnalysisReports);
document.getElementById('viewWeeklyHighlights').addEventListener('click', () => showDetailedReport('highlights'));
document.getElementById('viewRiskAlerts').addEventListener('click', () => showDetailedReport('risks'));
document.getElementById('viewKnowledgeGaps').addEventListener('click', () => showDetailedReport('gaps'));
document.getElementById('viewTeamPerformance').addEventListener('click', () => showDetailedReport('team'));

// Initialize messages on page load
populateMessageFilters();
loadMessages(true);
loadAnalysisReports();

refreshAll();
</script>
</body>
</html>`
res.setHeader('Content-Type', 'text/html; charset=utf-8')
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
res.setHeader('Pragma', 'no-cache')
res.setHeader('Expires', '0')
res.status(200).send(html)
})