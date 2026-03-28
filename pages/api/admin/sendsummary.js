import { verifyProject } from '../../../lib/token';
import { haloFetch } from '../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, ticketId, toEmail } = req.body || {};
  if (!token || !ticketId || !toEmail) return res.status(400).json({ error: 'Missing fields' });

  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email not configured' });

  try {
    const [ticket, actionsData] = await Promise.all([
      haloFetch(`/api/Tickets/${ticketId}`),
      haloFetch(`/api/Actions?ticket_id=${ticketId}&pagesize=20`),
    ]);

    const actions = (actionsData.actions || [])
      .filter(a => !a.hiddenfromuser && a.who_type !== 0 && a.note?.trim());

    const notesHtml = actions.map(a => `
      <div style="margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:6px;border-left:3px solid #89b4fa">
        <div style="font-size:0.8em;color:#666;margin-bottom:6px"><strong>${a.who}</strong> · ${a.datetime?.substring(0,10) || ''} ${a.timetaken>0?`· ⏱ ${a.timetaken.toFixed(1)}h`:''}</div>
        <div style="white-space:pre-wrap;font-size:0.9em">${a.note}</div>
      </div>
    `).join('');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://projects.sondelaconsulting.com';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Sondela Consulting <noreply@sondelaconsulting.com>',
        to:      [toEmail],
        subject: `Session Summary: ${ticket.summary}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#1e1e2e;border-bottom:2px solid #89b4fa;padding-bottom:8px">📋 Session Summary</h2>
            <p style="color:#666">${ticket.summary}</p>
            <h3 style="color:#1e1e2e">Notes &amp; Updates</h3>
            ${notesHtml || '<p style="color:#666">No notes recorded for this session.</p>'}
            <div style="margin-top:24px;padding:16px;background:#1e1e2e;border-radius:8px;text-align:center">
              <a href="${baseUrl}/p/${token}" style="color:#89b4fa;text-decoration:none;font-weight:bold">View Full Project Portal →</a>
            </div>
            <p style="color:#999;font-size:0.8em;margin-top:16px">Sent by Sondela Consulting · sondelaconsulting.com</p>
          </div>
        `,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
