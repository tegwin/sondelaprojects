import { verifyProject } from '../../../lib/token';
import { getScratchpad, setScratchpad } from '../../../lib/redis';
import { isLinkValid } from '../../../lib/redis';

export default async function handler(req, res) {
  const { token } = req.query;
  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  const linkCheck = await isLinkValid(projectId);
  if (!linkCheck.valid) return res.status(410).json({ error: 'Link inactive' });

  if (req.method === 'GET') {
    const items = await getScratchpad(projectId);
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const { action, item } = req.body || {};
    const items = await getScratchpad(projectId);

    if (action === 'add') {
      items.push({
        id:     Date.now().toString(),
        text:   item.text || '',
        done:   false,
        type:   item.type || 'todo', // 'todo' | 'note'
        author: item.author || 'client', // 'client' | 'admin'
        ts:     new Date().toISOString().substring(0, 10),
      });
    } else if (action === 'toggle') {
      const i = items.find(x => x.id === item.id);
      if (i) i.done = !i.done;
    } else if (action === 'delete') {
      const idx = items.findIndex(x => x.id === item.id);
      if (idx > -1) items.splice(idx, 1);
    } else if (action === 'edit') {
      const i = items.find(x => x.id === item.id);
      if (i) i.text = item.text;
    }

    await setScratchpad(projectId, items);
    return res.status(200).json({ items });
  }

  res.status(405).end();
}
