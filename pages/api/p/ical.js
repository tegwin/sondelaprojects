import { verifyProject } from '../../../lib/token';
import { isLinkValid, getNextSessionOverride } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';

function icalDate(d) {
  return d.replace(/-/g, '') + 'T090000Z';
}

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).end();

  try {
    const [project, override] = await Promise.all([
      haloFetch(`/api/Projects/${projectId}`),
      getNextSessionOverride(projectId),
    ]);

    const milestones = project.milestones || [];
    const ticketIds = [...new Set(milestones.flatMap(ms => ms.tickets_list.map(r => r.id)))];
    const tasks = await Promise.all(ticketIds.map(id => haloFetch(`/api/Tickets/${id}`).catch(() => null)));
    const validTasks = tasks.filter(t => t && t.startdate && !t.startdate.startsWith('1900'));

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sondela Consulting//Project Portal//EN',
      `X-WR-CALNAME:${project.summary}`,
      'X-WR-CALDESC:Project sessions from Sondela Consulting',
      'CALSCALE:GREGORIAN',
    ];

    // Add next session if manual override
    if (override?.startdate) {
      ical.push(
        'BEGIN:VEVENT',
        `UID:nextsession-${projectId}@sondelaconsulting.com`,
        `DTSTART:${icalDate(override.startdate)}`,
        `DTEND:${icalDate(override.startdate)}`,
        `SUMMARY:${override.summary || 'Next Session'}`,
        override.notes ? `DESCRIPTION:${override.notes}` : '',
        'END:VEVENT',
      );
    }

    // Add tasks with dates
    validTasks.forEach(t => {
      const start = t.startdate.substring(0, 10);
      ical.push(
        'BEGIN:VEVENT',
        `UID:task-${t.id}@sondelaconsulting.com`,
        `DTSTART:${icalDate(start)}`,
        `DTEND:${icalDate(start)}`,
        `SUMMARY:${t.summary.replace(/,/g, '\\,')}`,
        `DESCRIPTION:Project: ${project.summary}`,
        'END:VEVENT',
      );
    });

    ical.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}.ics"`);
    res.status(200).send(ical.filter(Boolean).join('\r\n'));
  } catch (e) {
    res.status(500).end();
  }
}
