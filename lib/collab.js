// Collaboration checklist - stored in Redis
// Items visible to both client and admin
// Client can add items, admin can check them off and add items

import { createHmac, randomBytes } from 'crypto';

const BASE  = process.env.UPSTASH_REDIS_URL;
const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

async function redis(command, ...args) {
  if (!BASE || !TOKEN) return null;
  const res = await fetch(`${BASE}/${[command, ...args.map(a => encodeURIComponent(String(a)))].join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

function collabKey(projectId) { return `project:${projectId}:collab`; }

export async function getCollabItems(projectId) {
  const raw = await redis('GET', collabKey(projectId));
  if (!raw) return [];
  try   { return JSON.parse(raw); }
  catch { return []; }
}

export async function addCollabItem(projectId, { text, author, authorName }) {
  const items = await getCollabItems(projectId);
  const item = {
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    author,      // 'client' | 'admin'
    authorName:  authorName || (author === 'admin' ? 'Sondela Consulting' : 'Client'),
    createdAt:   new Date().toISOString(),
    done:        false,
    doneBy:      null,
    doneAt:      null,
    pinned:      false,
  };
  items.push(item);
  await redis('SET', collabKey(projectId), JSON.stringify(items));
  return item;
}

export async function updateCollabItem(projectId, itemId, updates) {
  const items = await getCollabItems(projectId);
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  await redis('SET', collabKey(projectId), JSON.stringify(items));
  return items[idx];
}

export async function deleteCollabItem(projectId, itemId) {
  const items = await getCollabItems(projectId);
  const filtered = items.filter(i => i.id !== itemId);
  await redis('SET', collabKey(projectId), JSON.stringify(filtered));
}
