// Upstash Redis via REST API
const BASE  = process.env.UPSTASH_REDIS_URL;
const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

async function redis(command, ...args) {
  if (!BASE || !TOKEN) return null;

  // For SET commands, send value in body to avoid URL encoding issues
  if (command.toUpperCase() === 'SET' && args.length >= 2) {
    const [key, value] = args;
    const res = await fetch(`${BASE}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    return data.result ?? null;
  }

  // For GET/DEL/INCR etc, use URL path
  const res = await fetch(`${BASE}/${[command, ...args.map(a => encodeURIComponent(a))].join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

function metaKey(projectId)      { return `project:${projectId}:meta`; }
function viewCountKey(projectId) { return `project:${projectId}:views`; }
function firstViewKey(projectId) { return `project:${projectId}:firstview`; }
function scratchpadKey(projectId){ return `project:${projectId}:scratchpad`; }
function nextSessionKey(projectId){ return `project:${projectId}:nextsession`; }

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
  const results = await Promise.all(
    projectIds.map(async id => {
      const [meta, views, firstView] = await Promise.all([
        getLinkMeta(id),
        redis('GET', viewCountKey(id)),
        redis('GET', firstViewKey(id)),
      ]);
      return {
        projectId: id,
        ...meta,
        views: views ? parseInt(views) : 0,
        firstView: firstView || null,
      };
    })
  );
  return results;
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
  if (!data) {
    await redis('DEL', nextSessionKey(projectId));
  } else {
    await redis('SET', nextSessionKey(projectId), JSON.stringify(data));
  }
}
