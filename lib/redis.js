// Upstash Redis via REST API — no SDK, just fetch
const BASE  = process.env.UPSTASH_REDIS_URL;
const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

async function redis(command, ...args) {
  if (!BASE || !TOKEN) return null;
  const res = await fetch(`${BASE}/${[command, ...args.map(a => encodeURIComponent(a))].join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

function metaKey(projectId)     { return `project:${projectId}:meta`; }
function viewCountKey(projectId){ return `project:${projectId}:views`; }
function firstViewKey(projectId){ return `project:${projectId}:firstview`; }

export async function getLinkMeta(projectId) {
  const raw = await redis('GET', metaKey(projectId));
  if (!raw) return { revoked: false, expiresAt: null };
  try   { return JSON.parse(raw); }
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

// View tracking
export async function recordView(projectId) {
  const count = await redis('INCR', viewCountKey(projectId));
  const isFirst = count === 1;
  if (isFirst) {
    await redis('SET', firstViewKey(projectId), new Date().toISOString());
  }
  return { count, isFirst };
}

export async function getViewStats(projectId) {
  const [count, firstView] = await Promise.all([
    redis('GET', viewCountKey(projectId)),
    redis('GET', firstViewKey(projectId)),
  ]);
  return {
    views: count ? parseInt(count) : 0,
    firstView: firstView || null,
  };
}

// Bulk: get meta + views for multiple projects
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
