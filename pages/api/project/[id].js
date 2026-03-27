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

// Extract agent name from ticket — HaloPSA returns different fields
// depending on whether it's a list or full get response
function agentName(t) {
  return t.agent_name          // ticket list response
      || t.takenby             // full project response
      || t.agents_name         // some endpoints
      || (t.agent_id && t.agent_id !== 1 ? `Agent #${t.agent_id}` : null)
      || 'Unassigned';
}

async function getActions(ticketId) {
  try {
    const data = await haloFetch(`/api/Actions?ticket_id=${ticketId}&pagesize=50&includebydefault=true`);
    const actions = data.actions || [];
    return actions
      .filter(a => {
        // Exclude purely internal actions — show anything marked for end users
        // or not explicitly marked as internal
        const isInternal = a.isinternal || a.internal || a.who_type === 1;
        const showToUser = a.showforusers || a.show_to_user || a.isforpublicportal || a.enduser_visible;
        // Include if explicitly public OR not explicitly internal
        return showToUser || !isInternal;
      })
      .filter(a => {
        // Must have actual note content
        const note = a.note_html || a.note || '';
        return note.trim().length > 0;
      })
      .map(a => ({
        id: a.id,
        date: a.date ? a.date.substring(0, 16).replace('T', ' ') : null,
        who: a.who || a.agent_name || 'Unknown',
        note: a.note_html || a.note || '',
        timetaken: a.timetaken || a.time_taken || 0,
        outcome: a.outcome || a.outcome_name || '',
      }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const [project, ticketsData] = await Promise.all([
      haloFetch(`/api/Projects/${id}`),
      haloFetch(`/api/Tickets?project_id=${id}&pagesize=200`),
    ]);

    const allTickets = ticketsData.tickets || [];
    const tasks = allTickets.filter(
      t => t.id != project.id && (t.parent_id == project.id || t.main_project_id == project.id)
    );
    const taskMap = {};
    tasks.forEach(t => (taskMap[t.id] = t));

    // Fetch actions for all tasks in parallel
    const actionsMap = {};
    await Promise.all(tasks.map(async t => {
      actionsMap[t.id] = await getActions(t.id);
    }));

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

    // Orphan tasks not in any milestone
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

    const taskDetails = tasks.map(t => ({
      id: t.id,
      summary: t.summary,
      status: statusLabel(t.status_id),
      status_id: t.status_id,
      agent: agentName(t),
      startdate: fmtDate(t.startdate),
      targetdate: fmtDate(t.targetdate),
      hoursLogged: t.projecttimeactual || 0,
      details: t.details_html || t.details || '',
      milestone: milestones.find(ms => ms.tickets_list.some(r => r.id === t.id))?.name || 'Other',
      actions: actionsMap[t.id] || [],
    }));

    res.status(200).json({
      project: {
        id: project.id,
        summary: project.summary,
        client_name: project.client_name,
        agent_name: project.takenby || agentName(project),
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
