import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const { ticketId, minutes, note } = req.body || {};
  if (!ticketId || !minutes) return res.status(400).json({ error: 'ticketId and minutes required' });

  try {
    const action = await haloFetch('/api/Actions', {
      method: 'POST',
      body: JSON.stringify([{
        ticket_id:       ticketId,
        note:            note || 'Time logged via Project Portal',
        outcome_id:      40,
        timetaken:       minutes / 60,
        actisbillable:   true,
        who_agentid:     13,
        actionbillingplanid: 0,
      }]),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
