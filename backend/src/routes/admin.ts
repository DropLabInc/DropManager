import { Router } from 'express'

export const adminRouter = Router()

adminRouter.get('/health', (_req, res) => {
res.json({ ok: true, role: 'admin' })
})

adminRouter.get('/', (_req, res) => {
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
</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>DropManager — Admin Dashboard</h1>
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
      <h2>Employees</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Last Update</th><th>Completed</th><th>In Progress</th><th>Blocked</th></tr>
        </thead>
        <tbody id="employeeStats"><tr><td colspan="6" class="muted">Loading…</td></tr></tbody>
      </table>
    </section>

    <footer>DropManager Admin • <span class="muted">v0</span></footer>
  </div>

<script>
async function fetchJSON(path){
  const res = await fetch(path, { headers: { 'Accept':'application/json' }, cache: 'no-store' });
  if(!res.ok) throw new Error('Request failed: '+res.status);
  return await res.json();
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

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
    const data = await fetchJSON('/dashboard/overview?' + tsParam);
    renderOverview(data);
    const ts = new Date();
    document.getElementById('lastRefreshed').textContent = 'Updated ' + ts.toLocaleTimeString();
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

refreshAll();
</script>
</body>
</html>`
res.setHeader('Content-Type', 'text/html; charset=utf-8')
res.status(200).send(html)
})