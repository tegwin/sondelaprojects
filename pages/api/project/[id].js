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

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const [project, ticketsData] = await Promise.all([
      haloFetch(`/api/Projects/${id}`),
      haloFetch(`/api/Tickets?project_id=${id}&pagesize=200`),
    ]);

    const allTickets = ticketsData.tickets || [];
    // Only child tasks of this project, not the project ticket itself
    const tasks = allTickets.filter(
      t => t.id != project.id && (t.parent_id == project.id || t.main_project_id == project.id)
    );
    const taskMap = {};
    tasks.forEach(t => (taskMap[t.id] = t));

    const milestones = project.milestones || [];
    let rolling = fmtDate(project.dateoccurred) || new Date().toISOString().substring(0, 10);
    const lines = ['gantt', '    dateFormat YYYY-MM-DD', '    axisFormat %d %b', ''];

    // Always show all tasks grouped by milestone
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

      // Any tasks not in a milestone
      lines.push('');
    });

    // Tasks not in any milestone
    const inMilestone = new Set(milestones.flatMap(ms => ms.tickets_list.map(r => r.id)));
    const orphans = tasks.filter(t => !inMilestone.has(t.id));
    if (orphans.length > 0) {
      lines.push('    section Other Tasks');
      orphans.forEach(t => {
        const raw  = t.summary.replace(/[#:;{}\[\]"']/g, '').trim();
        const name = raw.length > 48 ? raw.substring(0, 45) + '...' : raw;
        const flag = CLOSED.includes(t.status_id) ? 'done, ' : ACTIVE.includes(t.status_id) ? 'active, ' : '';
        const start = fmtDate(t.startdate) || rolling;
        const dur   = '3d';
        lines.push(`    ${name.padEnd(50)} :${flag}t${t.id}, ${start}, ${dur}`);
        rolling = addDays(start, 3);
      });
      lines.push('');
    }

    const done   = tasks.filter(t => CLOSED.includes(t.status_id)).length;
    const active = tasks.filter(t => ACTIVE.includes(t.status_id)).length;
    const budget = project.budgets?.[0] || null;

    // Full task details for the hover/click panel
    const taskDetails = tasks.map(t => ({
      id: t.id,
      summary: t.summary,
      status: statusLabel(t.status_id),
      status_id: t.status_id,
      agent: t.agents_name || t.takenby || 'Unassigned',
      startdate: fmtDate(t.startdate),
      targetdate: fmtDate(t.targetdate),
      hoursLogged: t.projecttimeactual || 0,
      details: t.details || '',
      milestone: milestones.find(ms => ms.tickets_list.some(r => r.id === t.id))?.name || 'Other',
    }));

    res.status(200).json({
      project: {
        id: project.id,
        summary: project.summary,
        client_name: project.client_name,
        agent_name: project.takenby,
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
