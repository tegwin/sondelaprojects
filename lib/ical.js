// Generate iCal feed from project tasks

function icalDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace(/-/g, '') + 'T090000Z';
}

function escapeIcal(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateIcal({ project, tasks, baseUrl }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Sondela Consulting//Project Portal//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(project.summary)}`,
    `X-WR-CALDESC:${escapeIcal(project.client_name + ' - ' + project.summary)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const t of tasks) {
    if (!t.startdate && !t.targetdate) continue;
    const start = t.startdate || t.targetdate;
    const end   = t.targetdate || t.startdate;
    const uid   = `task-${t.id}@sondelaconsulting.com`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${end.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${escapeIcal(t.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcal(t.milestone + ' - ' + t.status)}`);
    if (baseUrl) lines.push(`URL:${baseUrl}`);
    lines.push(`STATUS:${['Completed'].includes(t.status) ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
