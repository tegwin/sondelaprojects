import { haloFetch } from '../../../lib/halo';
import { verifyProject } from '../../../lib/token';
import { isLinkValid, recordView } from '../../../lib/redis';
import { notifyFirstView } from '../../../lib/notify';

const CLOSED = [9, 16, 21];
const ACTIVE  = [2, 22];

function fmtDate(d) {
  if (!d || d.startsWith('1900') || d.startsWith('0001')) return null;
  return d.substring(0, 10);
}

function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().substring(0, 10);
}

function statusLabel(id) {
  if (CLOSED.includes(id)) return 'Completed';
  if (ACTIVE.includes(id)) return 'In Progress';
  return 'Pending';
}

async function getActions(ticketId) {
  try {
    const data = await haloFetch(`/api/Actions?ticket_id=${ticketId}&pagesize=50`);
    return (data.actions || [])
      .filter(a => !a.hiddenfromuser && a.who_type !== 0 && (a.note || '').trim())
      .map(a => ({
        id:        a.id,
        who:       a.who || 'Unknown',
        date:      a.datetime ? a.datetime.substring(0, 10) : null,
        timetaken: a.timetaken || 0,
        outcome:   a.outcome || '',
        note:      a.note || '',
      }));
  } catch { return []; }
}

async function getAgentMap() {
  try {
    const data = await haloFetch('/api/Agent?pagesize=100');
    const map = {};
    (data.agents || []).forEach(a => {
      if (a.id) map[a.id] = a.name || `${a.firstname||''} ${a.surname||''}`.trim();
    });
    return map;
  } catch { return {}; }
}

function calcMilestoneState(ms, taskMap) {
  const msTasks = ms.tickets_list.map(r => taskMap[r.id]).filter(Boolean);
  if (msTasks.length === 0) return 0;
  if (msTasks.every(t => CLOSED.includes(t.status_id))) return 2;
  if (msTasks.some(t => ACTIVE.includes(t.status_id) || CLOSED.includes(t.status_id))) return 1;
  return 0;
}

function calcRAG(tasks) {
  const today = new Date();
  today.setHours(0,0,0,0);
  let overdue = 0, atRisk = 0;
  for (const t of tasks) {
    if (CLOSED.includes(t.status_id)) continue;
    const target = fmtDate(t.targetdate);
    if (!target) continue;
    const diff = (new Date(target) - today) / 86400000;
    if (diff < 0) overdue++;
    else if (diff <= 7) atRisk++;
  }
  if (overdue > 0) return { status: 'red',   label: `${overdue} overdue task${overdue>1?'s':''}` };
  if (atRisk  > 0) return { status: 'amber', label: `${atRisk} task${atRisk>1?'s':''} due within 7 days` };
  return { status: 'green', label: 'On track' };
}

function calcBurnRate(tasks, hoursLogged, budgetHours) {
  const done = tasks.filter(t => CLOSED.includes(t.status_id)).length;
  const remaining = tasks.length - done;
  if (done === 0 || hoursLogged === 0) return null;
  const hrsPerTask = hoursLogged / done;
  const projected  = hoursLogged + (hrsPerTask * remaining);
  const onBudget   = budgetHours ? projected <= budgetHours : null;
  return {
    hrsPerTask:    Math.round(hrsPerTask * 10) / 10,
    projectedTotal: Math.round(projected * 10) / 10,
    budgetHours,
    onBudget,
    tasksRemaining: remaining,
  };
}

function findNextSession(tasks) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const upcoming = tasks
    .filter(t => !CLOSED.includes(t.status_id))
    .filter(t => fmtDate(t.startdate))
    .sort((a, b) => new Date(a.startdate) - new Date(b.startdate));
  if (!upcoming.length) return null;
  const t = upcoming[0];
  return { id: t.id, summary: t.summary, startdate: fmtDate(t.startdate) };
}

export default async function handler(req, res) {
  const { token } = req.query;

  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Project not found' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) {
    return res.status(410).json({
      error: linkCheck.reason === 'expired'
        ? 'This project link has expired.'
        : 'This project link has been deactivated.',
      reason: linkCheck.reason,
    });
  }

  // Record view and notify on first view (non-blocking)
  const viewPromise = recordView(projectId);

  try {
    const [project, agentMap] = await Promise.all([
      haloFetch(`/api/Projects/${projectId}`),
      getAgentMap(),
    ]);

    const milestones = project.milestones || [];
    const allTicketIds = [...new Set(milestones.flatMap(ms => ms.tickets_list.map(r => r.id)))];

    const taskResults = await Promise.all(
      allTicketIds.map(id => haloFetch(`/api/Tickets/${id}`).catch(() => null))
    );
    const tasks = taskResults.filter(Boolean);
    const taskMap = {};
    tasks.forEach(t => (taskMap[t.id] = t));

    const actionsMap = {};
    await Promise.all(tasks.map(async t => { actionsMap[t.id] = await getActions(t.id); }));

    function agentName(t) {
      if (t.agent_id && t.agent_id !== 1 && agentMap[t.agent_id]) return agentMap[t.agent_id];
      if (t.takenby?.trim()) return t.takenby.trim();
      return 'Unassigned';
    }

    // Build Gantt
    let rolling = fmtDate(project.dateoccurred) || new Date().toISOString().substring(0, 10);
    const lines = ['gantt', '    dateFormat YYYY-MM-DD', '    axisFormat %d %b', ''];
    milestones.forEach(ms => {
      const section = ms.name.replace(/[#:;{}\[\]]/g, '').trim();
      lines.push(`    section ${section}`);
      ms.tickets_list.forEach(ref => {
        const t = taskMap[ref.id];
        if (!t) return;
        const raw  = t.summary.replace(/[#:;{}\[\]"']/g, '').trim();
        const name = raw.length > 48 ? raw.substring(0, 45) + '...' : raw;
        const flag = CLOSED.includes(t.status_id) ? 'done, ' : ACTIVE.includes(t.status_id) ? 'active, ' : '';
        const start = fmtDate(t.startdate) || rolling;
        const end   = fmtDate(t.targetdate);
        const dur   = (end && fmtDate(t.startdate))
          ? Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000)) + 'd' : '3d';
        lines.push(`    ${name.padEnd(50)} :${flag}t${t.id}, ${start}, ${dur}`);
        rolling = addDays(start, parseInt(dur));
      });
      lines.push('');
    });

    const done    = tasks.filter(t => CLOSED.includes(t.status_id)).length;
    const active  = tasks.filter(t => ACTIVE.includes(t.status_id)).length;
    const budget  = project.budgets?.[0] || null;
    const hoursLogged = project.projecttimeactual || 0;

    // Derived data
    const rag       = calcRAG(tasks);
    const burnRate  = calcBurnRate(tasks, hoursLogged, budget?.hours || null);
    const nextSession = findNextSession(tasks);

    // Project date range
    const allStarts  = tasks.map(t => fmtDate(t.startdate)).filter(Boolean).sort();
    const allTargets = tasks.map(t => fmtDate(t.targetdate)).filter(Boolean).sort();
    const projectStart = fmtDate(project.dateoccurred);
    const projectEnd   = allTargets.length ? allTargets[allTargets.length - 1] : null;

    const taskDetails = tasks.map(t => ({
      id:          t.id,
      summary:     t.summary,
      status:      statusLabel(t.status_id),
      status_id:   t.status_id,
      agent:       agentName(t),
      startdate:   fmtDate(t.startdate),
      targetdate:  fmtDate(t.targetdate),
      lastUpdated: t.last_update ? t.last_update.substring(0, 10) : null,
      hoursLogged: t.projecttimeactual || 0,
      details:     t.details_html || (t.details ? `<p>${t.details}</p>` : ''),
      milestone:   milestones.find(ms => ms.tickets_list.some(r => r.id === t.id))?.name || 'Other',
      actions:     actionsMap[t.id] || [],
    }));

    // Handle view notification
    const viewResult = await viewPromise;
    if (viewResult?.isFirst) {
      notifyFirstView({
        projectName: project.summary,
        clientName:  project.client_name,
        projectId,
        token,
      }).catch(() => {});
    }

    res.status(200).json({
      project: {
        id:            project.id,
        summary:       project.summary,
        client_name:   project.client_name,
        client_id:     project.client_id,
        client_colour: project.colour || '#89b4fa',
        agent_name:    project.takenby || agentMap[project.agent_id] || 'Sondela Consulting',
        startDate:     projectStart,
        endDate:       projectEnd,
      },
      stats: {
        total:          tasks.length,
        done,
        active,
        pending:        tasks.length - done - active,
        hoursLogged,
        budgetHours:    budget?.hours || null,
        remainingHours: budget?.remaining_hours ?? null,
        pctComplete:    tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
      },
      rag,
      burnRate,
      nextSession,
      ganttCode:  lines.join('\n'),
      milestones: milestones.map(ms => ({
        name:      ms.name,
        state:     calcMilestoneState(ms, taskMap),
        taskCount: ms.tickets_list.length,
      })),
      taskDetails,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
