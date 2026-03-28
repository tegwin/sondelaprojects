// Upstash Redis via REST API — pipeline format handles all value types correctly
const BASE  = process.env.UPSTASH_REDIS_URL;
const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

async function redis(command, ...args) {
  if (!BASE || !TOKEN) return null;
  const res = await fetch(`${BASE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([[command, ...args]]),
  });
  const data = await res.json();
  return data[0]?.result ?? null;
}

function metaKey(id)        { return `project:${id}:meta`; }
function viewCountKey(id)   { return `project:${id}:views`; }
function firstViewKey(id)   { return `project:${id}:firstview`; }
function scratchpadKey(id)  { return `project:${id}:scratchpad`; }
function nextSessionKey(id) { return `project:${id}:nextsession`; }

export async function getLinkMeta(projectId) {
  const raw = await redis('GET', metaKey(projectId));
  if (!raw) return { revoked: false, expiresAt: null };
  try   { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { revoked: false, expiresAt: null }; }
}

export async function setLinkMeta(projectId, meta) {
  await redis('SET', metaKey(projectId), JSON.stringify(meta));
}

export async function isLinkValid(projectId) {
  const meta = await getLinkMeta(projectId);
  if (meta.revoked) return { valid: false, reason: 'revoked' };
  if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) return { valid: false, reason: 'expired' };
  return { valid: true, meta };
}

export async function recordView(projectId) {
  const count = await redis('INCR', viewCountKey(projectId));
  const isFirst = count === 1;
  if (isFirst) await redis('SET', firstViewKey(projectId), new Date().toISOString());
  return { count, isFirst };
}

export async function getViewStats(projectId) {
  const [count, firstView] = await Promise.all([
    redis('GET', viewCountKey(projectId)),
    redis('GET', firstViewKey(projectId)),
  ]);
  return { views: count ? parseInt(count) : 0, firstView: firstView || null };
}

export async function getBulkLinkData(projectIds) {
  return Promise.all(projectIds.map(async id => {
    const [meta, views, firstView] = await Promise.all([
      getLinkMeta(id),
      redis('GET', viewCountKey(id)),
      redis('GET', firstViewKey(id)),
    ]);
    return { projectId: id, ...meta, views: views ? parseInt(views) : 0, firstView: firstView || null };
  }));
}

export async function getScratchpad(projectId) {
  const raw = await redis('GET', scratchpadKey(projectId));
  if (!raw) return [];
  try   { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return []; }
}

export async function setScratchpad(projectId, items) {
  await redis('SET', scratchpadKey(projectId), JSON.stringify(items));
}

export async function getNextSessionOverride(projectId) {
  const raw = await redis('GET', nextSessionKey(projectId));
  if (!raw) return null;
  try   { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
}

export async function setNextSessionOverride(projectId, data) {
  if (!data) await redis('DEL', nextSessionKey(projectId));
  else       await redis('SET', nextSessionKey(projectId), JSON.stringify(data));
}
