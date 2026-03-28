import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const { ticketId, note, isPrivate } = req.body || {};
  if (!ticketId || !note?.trim()) return res.status(400).json({ error: 'ticketId and note required' });

  try {
    const action = await haloFetch('/api/Actions', {
      method: 'POST',
      body: JSON.stringify([{
        ticket_id:      ticketId,
        note:           note.trim(),
        outcome_id:     isPrivate ? 7 : 40,  // 7=Private Note, 40=Ticket Note
        hiddenfromuser: isPrivate ? true : false,
        who_agentid:    13, // Chris Timm
        actionbillingplanid: 0,
      }]),
    });
    res.status(200).json({ ok: true, action });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
