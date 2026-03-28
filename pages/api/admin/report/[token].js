import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const CLOSED = [9,16,21], ACTIVE = [2,22];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  try {
    const project = await haloFetch(`/api/Projects/${projectId}`);
    const milestones = project.milestones || [];
    const allIds = milestones.flatMap(ms => ms.tickets_list.map(r => r.id));
    const tasks = (await Promise.all(allIds.map(id => haloFetch(`/api/Tickets/${id}`).catch(()=>null)))).filter(Boolean);

    // Recent activity - tasks updated in last 7 days
    const recentlyUpdated = tasks.filter(t => t.last_update && new Date(t.last_update) > weekAgo);
    const completedThisWeek = tasks.filter(t => CLOSED.includes(t.status_id) && t.last_update && new Date(t.last_update) > weekAgo);
    const inProgress = tasks.filter(t => ACTIVE.includes(t.status_id));
    const done = tasks.filter(t => CLOSED.includes(t.status_id));
    const hoursThisWeek = recentlyUpdated.reduce((a,t) => a + (t.projecttimeactual||0), 0);

    res.status(200).json({
      report: {
        projectName:    project.summary,
        clientName:     project.client_name,
        weekEnding:     new Date().toLocaleDateString('en-GB'),
        totalTasks:     tasks.length,
        doneTasks:      done.length,
        pctComplete:    tasks.length > 0 ? Math.round((done.length/tasks.length)*100) : 0,
        hoursThisWeek:  Math.round(hoursThisWeek * 10) / 10,
        totalHours:     Math.round((project.projecttimeactual||0) * 10) / 10,
        budgetHours:    project.budgets?.[0]?.hours || null,
        completedThisWeek: completedThisWeek.map(t => ({
          id: t.id, summary: t.summary,
          milestone: milestones.find(ms => ms.tickets_list.some(r=>r.id===t.id))?.name || '',
        })),
        inProgress: inProgress.map(t => ({
          id: t.id, summary: t.summary,
          milestone: milestones.find(ms => ms.tickets_list.some(r=>r.id===t.id))?.name || '',
        })),
        upcoming: tasks
          .filter(t => !CLOSED.includes(t.status_id) && !ACTIVE.includes(t.status_id))
          .slice(0, 5)
          .map(t => ({
            id: t.id, summary: t.summary,
            milestone: milestones.find(ms => ms.tickets_list.some(r=>r.id===t.id))?.name || '',
            startdate: t.startdate ? t.startdate.substring(0,10) : null,
          })),
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
