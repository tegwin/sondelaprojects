import { getNextSessionOverride, setNextSessionOverride } from '../../../../lib/redis';
import { verifyProject } from '../../../../lib/token';

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const data = await getNextSessionOverride(projectId);
    return res.status(200).json({ override: data });
  }

  if (req.method === 'POST') {
    const { label, date, notes } = req.body || {};
    if (!label && !date) {
      await setNextSessionOverride(projectId, null);
    } else {
      await setNextSessionOverride(projectId, { summary: label, startdate: date, notes: notes || '' });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await setNextSessionOverride(projectId, null);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
