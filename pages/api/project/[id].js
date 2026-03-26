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

export default async function handler(req, res) {
  const { id, showTasks } = req.query;
  const tasks_mode = showTasks === 'true';

  try {
    const [project, ticketsData] = await Promise.all([
      haloFetch(`/api/Projects/${id}`),
      haloFetch(`/api/Tickets?project_id=${id}&pagesize=100`),
    ]);

    const tasks = (ticketsData.tickets || []).filter(
      t => t.id != project.id && t.client_id == project.client_id
    );
    const taskMap = {};
    tasks.forEach(t => (taskMap[t.id] = t));

    const milestones = project.milestones || [];
    let rolling = fmtDate(project.dateoccurred) || new Date().toISOString().substring(0, 10);
    const lines = ['gantt', '    dateFormat YYYY-MM-DD', '    axisFormat %d %b', ''];

    milestones.forEach(ms => {
      const section = ms.name.replace(/[#:;{}\[\]]/g, '').trim();
      lines.push(`    section ${section}`);

      if (tasks_mode) {
        ms.tickets_list.forEach(ref => {
          const t = taskMap[ref.id];
          if (!t) return;
          const raw = t.summary.replace(/[#:;{}\[\]]/g, '').trim();
          const name = raw.length > 50 ? raw.substring(0, 47) + '...' : raw;
          const flag = CLOSED.includes(t.status_id) ? 'done, ' : ACTIVE.includes(t.status_id) ? 'active, ' : '';
          const start = fmtDate(t.startdate) || rolling;
          const end   = fmtDate(t.targetdate);
          const dur   = end && fmtDate(t.startdate)
            ? Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000)) + 'd'
            : '3d';
          lines.push(`    ${name.padEnd(52)} :${flag}t${t.id}, ${start}, ${dur}`);
          rolling = addDays(start, parseInt(dur));
        });
      } else {
        const msTasks = ms.tickets_list.map(r => taskMap[r.id]).filter(Boolean);
        const allDone = msTasks.length > 0 && msTasks.every(t => CLOSED.includes(t.status_id));
        const anyActive = msTasks.some(t => ACTIVE.includes(t.status_id));
        const flag  = allDone ? 'done, ' : anyActive ? 'active, ' : '';
        const starts = msTasks.map(t => fmtDate(t.startdate)).filter(Boolean).sort();
        const ends   = msTasks.map(t => fmtDate(t.targetdate)).filter(Boolean).sort();
        const start  = starts[0] || fmtDate(ms.start_date) || rolling;
        const end    = ends[ends.length - 1];
        const dur    = end && start
          ? Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000)) + 'd'
          : (msTasks.length * 3) + 'd';
        const name = section.length > 50 ? section.substring(0, 47) + '...' : section;
        lines.push(`    ${name.padEnd(52)} :${flag}ms${ms.id}, ${start}, ${dur}`);
        rolling = addDays(start, parseInt(dur));
      }
      lines.push('');
    });

    const pt    = tasks.filter(t => t.parent_id == project.id || t.main_project_id == project.id);
    const done  = pt.filter(t => CLOSED.includes(t.status_id)).length;
    const active = pt.filter(t => ACTIVE.includes(t.status_id)).length;
    const budget = project.budgets?.[0] || null;

    res.status(200).json({
      project: {
        id: project.id,
        summary: project.summary,
        client_name: project.client_name,
        agent_name: project.takenby,
      },
      stats: {
        total: pt.length,
        done,
        active,
        pending: pt.length - done - active,
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
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
