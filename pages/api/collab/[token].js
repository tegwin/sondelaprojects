import { verifyProject } from '../../../lib/token';
import { isLinkValid } from '../../../lib/redis';
import { getCollabItems, addCollabItem } from '../../../lib/collab';

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Not found' });

  // For GET, still check link validity
  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  if (req.method === 'GET') {
    const items = await getCollabItems(projectId);
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const { text, author, authorName } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const item = await addCollabItem(projectId, {
      text: text.trim(),
      author:     author || 'client',
      authorName: authorName || (author === 'admin' ? 'Sondela Consulting' : 'Client'),
    });
    return res.status(201).json({ item });
  }

  res.status(405).end();
}
