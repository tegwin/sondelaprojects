import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';
import { escapeHtml } from '../../../../lib/escapeHtml';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const { ticketId, toEmails, customNote } = req.body || {};
  if (!ticketId || !toEmails?.length) return res.status(400).json({ error: 'ticketId and toEmails required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email not configured' });

  try {
    const [ticket, actionsData] = await Promise.all([
      haloFetch(`/api/Tickets/${ticketId}`),
      haloFetch(`/api/Actions?ticket_id=${ticketId}&pagesize=20`),
    ]);

    const actions = (actionsData.actions||[])
      .filter(a => !a.hiddenfromuser && a.who_type !== 0 && a.note?.trim())
      .slice(0, 5);

    const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL||'https://projects.sondelaconsulting.com'}/p/${token}`;

    const notesHtml = actions.map(a => `
      <div style="margin:12px 0;padding:12px;background:#f8f9fa;border-left:3px solid #89b4fa;border-radius:4px">
        <div style="font-size:0.8em;color:#666;margin-bottom:6px">${escapeHtml(a.who)} · ${a.datetime?.substring(0,10)||''}</div>
        <div style="font-size:0.9em;white-space:pre-wrap">${escapeHtml(a.note)}</div>
      </div>
    `).join('');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Sondela Consulting <noreply@sondelaconsulting.com>',
        to:      toEmails,
        subject: `Session Summary: ${ticket.summary}`,  // a header, not HTML: escaping would show entities
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1e1e2e;color:#cdd6f4;padding:24px;border-radius:12px 12px 0 0">
              <h2 style="margin:0;color:#89b4fa">Session Summary</h2>
              <p style="color:#a6adc8;margin:8px 0 0">${escapeHtml(ticket.summary)}</p>
            </div>
            <div style="padding:24px;border:1px solid #e0e0e0;border-top:none">
              ${customNote ? `<p style="font-size:0.95em">${escapeHtml(customNote)}</p><hr/>` : ''}
              <h3 style="color:#333">Session Notes</h3>
              ${notesHtml || '<p style="color:#666">No notes recorded for this session.</p>'}
              <div style="margin-top:24px;padding:16px;background:#f0f4ff;border-radius:8px">
                <p style="margin:0 0 8px;font-size:0.9em;color:#333">View live project status:</p>
                <a href="${portalUrl}" style="background:#89b4fa;color:#1e1e2e;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
                  Open Project Portal →
                </a>
              </div>
            </div>
            <div style="padding:16px;text-align:center;font-size:0.8em;color:#999">
              Sent by Sondela Consulting · <a href="https://sondelaconsulting.com">sondelaconsulting.com</a>
            </div>
          </div>
        `,
      }),
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
