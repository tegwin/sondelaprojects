import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  const { action, ticketId, note, minutes } = req.body || {};
  if (!ticketId || !note?.trim()) return res.status(400).json({ error: 'Missing fields' });

  try {
    if (action === 'note') {
      await haloFetch('/api/Actions', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id:        ticketId,
          note:             note.trim(),
          hiddenfromuser:   false,
          outcome:          'Note Added',
          who_type:         1,
          actionby_agent_id: 13, // Chris Timm
        }),
      });
    } else if (action === 'time') {
      await haloFetch('/api/Actions', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id:        ticketId,
          note:             note.trim(),
          timetaken:        (minutes || 60) / 60,
          hiddenfromuser:   false,
          outcome:          'Time Added',
          who_type:         1,
          actionby_agent_id: 13,
          actisbillable:    true,
        }),
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
