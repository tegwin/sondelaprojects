import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { haloFetch } from '../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  const { milestoneName, signerName } = req.body || {};
  if (!milestoneName) return res.status(400).json({ error: 'Missing milestone' });

  try {
    // Post sign-off note to the project ticket itself
    await haloFetch('/api/Actions', {
      method: 'POST',
      body: JSON.stringify({
        ticket_id:       projectId,
        note:            `✅ Milestone sign-off: "${milestoneName}" approved by ${signerName || 'Client'} via portal on ${new Date().toLocaleDateString('en-GB')}`,
        hiddenfromuser:  false,
        outcome:         'Milestone Approved',
        who:             signerName || 'Client (via Portal)',
        who_type:        3,
        actionby_agent_id: 0,
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
