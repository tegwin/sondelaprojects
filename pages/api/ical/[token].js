import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';
import { generateIcal } from '../../../lib/ical';

const CLOSED = [9,16,21], ACTIVE=[2,22];
function fmtDate(d){ return (!d||d.startsWith('1900')||d.startsWith('0001'))?null:d.substring(0,10); }
function statusLabel(id){ return CLOSED.includes(id)?'Completed':ACTIVE.includes(id)?'In Progress':'Pending'; }

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).send('Not found');

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).send('Link inactive');

  try {
    const project = await haloFetch(`/api/Projects/${projectId}`);
    const milestones = project.milestones || [];
    const allIds = milestones.flatMap(ms => ms.tickets_list.map(r => r.id));
    const tasks = (await Promise.all(allIds.map(id => haloFetch(`/api/Tickets/${id}`).catch(()=>null)))).filter(Boolean);

    const taskDetails = tasks.map(t => ({
      id: t.id, summary: t.summary,
      startdate: fmtDate(t.startdate), targetdate: fmtDate(t.targetdate),
      status: statusLabel(t.status_id), status_id: t.status_id,
      milestone: milestones.find(ms => ms.tickets_list.some(r=>r.id===t.id))?.name || '',
    }));

    const baseUrl = `${process.env.NEXT_PUBLIC_BASE_URL||'https://projects.sondelaconsulting.com'}/p/${token}`;
    const ical = generateIcal({ project: { summary: project.summary, client_name: project.client_name }, tasks: taskDetails, baseUrl });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${project.summary.replace(/[^a-z0-9]/gi,'_')}.ics"`);
    res.status(200).send(ical);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
}
