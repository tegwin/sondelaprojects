import { verifyProject } from '../../../../lib/token';
import { haloFetch } from '../../../../lib/halo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  const { milestoneName, signedBy } = req.body || {};
  if (!milestoneName) return res.status(400).json({ error: 'milestoneName required' });

  try {
    await haloFetch('/api/Actions', {
      method: 'POST',
      body: JSON.stringify([{
        ticket_id:      projectId,
        note:           `✅ Client sign-off received for milestone: ${milestoneName}\nSigned by: ${signedBy || 'Client'}\nDate: ${new Date().toLocaleDateString('en-GB')}`,
        outcome_id:     40,
        hiddenfromuser: false,
        who_agentid:    13,
        actionbillingplanid: 0,
      }]),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
