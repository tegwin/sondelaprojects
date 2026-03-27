import { haloFetch } from '../../../lib/halo';

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

// Fetch full ticket details to get closure_note and proper agent info
async function getTicketDetail(ticketId) {
  try {
    return await haloFetch(`/api/Tickets/${ticketId}`);
  } catch {
    return null;
  }
}

// Build agent name map from the agents list
async function getAgentMap() {
  try {
    const data = await haloFetch('/api/Agent?pagesize=100');
    const agents = data.agents || data || [];
    const map = {};
    agents.forEach(a => {
      if (a.id) map[a.id] = a.name || `${a.firstname || ''} ${a.surname || ''}`.trim();
    });
    return map;
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // Fetch project, ticket list, and agent map in parallel
    const [project, ticketsData, agentMap] = await Promise.all([
      haloFetch(`/api/Projects/${id}`),
      haloFetch(`/api/Tickets?project_id=${id}&pagesize=200`),
      getAgentMap(),
    ]);

    const allTickets = ticketsData.tickets || [];
    const taskList = allTickets.filter(
      t => t.id != project.id && (t.parent_id == project.id || t.main_project_id == project.id)
    );

    // Fetch full details for each task in parallel (to get closure_note, agent info)
    const fullDetails = await Promise.all(taskList.map(t => getTicketDetail(t.id)));

    // Merge list data with full detail data
    const tasks = taskList.map((t, i) => {
      const detail = fullDetails[i] || t;
      return { ...t, ...detail };
    });

    const taskMap = {};
    tasks.forEach(t => (taskMap[t.id] = t));

    function agentName(t) {
      // Try agent map first (most reliable), then various name fields
      if (t.agent_id && t.agent_id !== 1 && agentMap[t.agent_id]) return agentMap[t.agent_id];
      if (t.takenby && t.takenby.trim()) return t.takenby.trim();
      if (t.agent_name && t.agent_name.trim()) return t.agent_name.trim();
      if (t.agents_name && t.agents_name.trim()) return t.agents_name.trim();
      return 'Unassigned';
    }

    const milestones = project.milestones || [];
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
          ? Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000)) + 'd'
          : '3d';
        lines.push(`    ${name.padEnd(50)} :${flag}t${t.id}, ${start}, ${dur}`);
        rolling = addDays(start, parseInt(dur));
      });
      lines.push('');
    });

    // Orphan tasks
    const inMilestone = new Set(milestones.flatMap(ms => ms.tickets_list.map(r => r.id)));
    const orphans = tasks.filter(t => !inMilestone.has(t.id));
    if (orphans.length > 0) {
      lines.push('    section Other Tasks');
      orphans.forEach(t => {
        const raw  = t.summary.replace(/[#:;{}\[\]"']/g, '').trim();
        const name = raw.length > 48 ? raw.substring(0, 45) + '...' : raw;
        const flag = CLOSED.includes(t.status_id) ? 'done, ' : ACTIVE.includes(t.status_id) ? 'active, ' : '';
        const start = fmtDate(t.startdate) || rolling;
        lines.push(`    ${name.padEnd(50)} :${flag}t${t.id}, ${start}, 3d`);
        rolling = addDays(start, 3);
      });
      lines.push('');
    }

    const done   = tasks.filter(t => CLOSED.includes(t.status_id)).length;
    const active = tasks.filter(t => ACTIVE.includes(t.status_id)).length;
    const budget = project.budgets?.[0] || null;

    const taskDetails = tasks.map(t => {
      // Build notes from closure_note (available on full ticket) and details
      const notes = [];

      // closure_note is the main public summary note
      if (t.closure_note && t.closure_note.trim()) {
        notes.push({
          id: `closure_${t.id}`,
          label: 'Session Summary',
          who: agentName(t),
          date: t.dateclosed ? t.dateclosed.substring(0, 10) : fmtDate(t.targetdate),
          timetaken: t.closure_time || t.timetaken || 0,
          html: `<div style="white-space:pre-wrap">${t.closure_note.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`,
        });
      }

      return {
        id: t.id,
        summary: t.summary,
        status: statusLabel(t.status_id),
        status_id: t.status_id,
        agent: agentName(t),
        startdate: fmtDate(t.startdate),
        targetdate: fmtDate(t.targetdate),
        hoursLogged: t.projecttimeactual || t.timetaken || 0,
        details: t.details_html || (t.details ? `<p>${t.details}</p>` : ''),
        milestone: milestones.find(ms => ms.tickets_list.some(r => r.id === t.id))?.name || 'Other',
        notes,
      };
    });

    res.status(200).json({
      project: {
        id: project.id,
        summary: project.summary,
        client_name: project.client_name,
        agent_name: project.takenby || (project.agent_id ? agentMap[project.agent_id] : '') || 'Sondela Consulting',
      },
      stats: {
        total: tasks.length,
        done,
        active,
        pending: tasks.length - done - active,
        hoursLogged: project.projecttimeactual || 0,
        budgetHours: budget?.hours || null,
        remainingHours: budget?.remaining_hours ?? null,
      },
      ganttCode: lines.join('\n'),
      milestones: milestones.map(ms => ({
        name: ms.name,
        state: ms.state,
        taskCount: ms.tickets_list.length,
      })),
      taskDetails,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
