import { getLinkMeta, setLinkMeta } from '../../../lib/redis';
import { verifyProject } from '../../../lib/token';

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const meta = await getLinkMeta(projectId);
    return res.status(200).json({ projectId, ...meta });
  }

  if (req.method === 'POST') {
    const { revoked, expiresAt } = req.body || {};
    const current = await getLinkMeta(projectId);
    await setLinkMeta(projectId, {
      revoked:   typeof revoked === 'boolean' ? revoked : current.revoked,
      expiresAt: expiresAt !== undefined ? expiresAt : current.expiresAt,
    });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
