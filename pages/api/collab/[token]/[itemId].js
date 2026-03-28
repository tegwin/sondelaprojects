import { verifyProject } from '../../../../lib/token';
import { updateCollabItem, deleteCollabItem } from '../../../../lib/collab';

export default async function handler(req, res) {
  const { token, itemId } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  if (req.method === 'PATCH') {
    const updates = req.body || {};
    if (updates.done === true && !updates.doneAt) {
      updates.doneAt = new Date().toISOString();
      updates.doneBy = updates.doneBy || 'Sondela Consulting';
    }
    if (updates.done === false) {
      updates.doneAt = null;
      updates.doneBy = null;
    }
    const item = await updateCollabItem(projectId, itemId, updates);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.status(200).json({ item });
  }

  if (req.method === 'DELETE') {
    await deleteCollabItem(projectId, itemId);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
