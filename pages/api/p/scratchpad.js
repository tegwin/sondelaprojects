import { verifyProject } from '../../../lib/token';
import { getScratchpad, setScratchpad, isLinkValid } from '../../../lib/redis';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'No token' });

  const projectId = verifyProject(token);
  if (!projectId) return res.status(404).json({ error: 'Invalid token' });

  // Skip link check for scratchpad — don't block on Redis failures
  // isLinkValid also uses Redis so if Redis is down it would block the scratchpad too

  if (req.method === 'GET') {
    try {
      const items = await getScratchpad(projectId);
      return res.status(200).json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      return res.status(200).json({ items: [], error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action, item } = req.body || {};
    if (!action) return res.status(400).json({ error: 'No action' });

    try {
      let items = await getScratchpad(projectId);
      if (!Array.isArray(items)) items = [];

      if (action === 'add') {
        if (!item?.text?.trim()) return res.status(400).json({ error: 'No text' });
        items.push({
          id:     Date.now().toString(),
          text:   item.text.trim(),
          done:   false,
          type:   item.type || 'todo',
          author: item.author || 'client',
          ts:     new Date().toISOString().substring(0, 10),
        });
      } else if (action === 'toggle') {
        const i = items.find(x => x.id === item?.id);
        if (i) i.done = !i.done;
      } else if (action === 'delete') {
        const idx = items.findIndex(x => x.id === item?.id);
        if (idx > -1) items.splice(idx, 1);
      } else if (action === 'edit') {
        const i = items.find(x => x.id === item?.id);
        if (i && item?.text?.trim()) i.text = item.text.trim();
      }

      await setScratchpad(projectId, items);
      return res.status(200).json({ items, saved: true });
    } catch (e) {
      return res.status(500).json({ error: e.message, items: [] });
    }
  }

  res.status(405).end();
}
