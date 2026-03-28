import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  const { ticketId, note, authorName } = req.body || {};
  if (!ticketId || !note?.trim()) return res.status(400).json({ error: 'Missing fields' });

  const formattedNote = `📋 Client note from ${authorName || 'Client'} (via Project Portal):\n\n${note.trim()}`;

  try {
    await haloFetch('/api/Actions', {
      method: 'POST',
      body: JSON.stringify([{
        ticket_id:         parseInt(ticketId),
        note:              formattedNote,
        hiddenfromuser:    false,
        outcome:           'note',
        who_type:          3,           // end user / customer
        actionby_agent_id: 0,
        new_status_id:     1,           // sets ticket to "New" / Customer Updated
      }]),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
