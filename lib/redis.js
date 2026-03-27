// Upstash Redis via REST API — no SDK, just fetch
// Set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN in Vercel env vars

const BASE  = process.env.UPSTASH_REDIS_URL;
const TOKEN = process.env.UPSTASH_REDIS_TOKEN;

async function redis(command, ...args) {
  if (!BASE || !TOKEN) return null; // graceful fallback if not configured
  const res = await fetch(`${BASE}/${[command, ...args].join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

// Key: project:<id>:meta  →  JSON { revoked: bool, expiresAt: ISO|null }
function key(projectId) {
  return `project:${projectId}:meta`;
}

export async function getLinkMeta(projectId) {
  const raw = await redis('GET', key(projectId));
  if (!raw) return { revoked: false, expiresAt: null };
  try   { return JSON.parse(raw); }
  catch { return { revoked: false, expiresAt: null }; }
}

export async function setLinkMeta(projectId, meta) {
  const val = JSON.stringify(meta);
  await redis('SET', key(projectId), encodeURIComponent(val));
}

export async function isLinkValid(projectId) {
  const meta = await getLinkMeta(projectId);
  if (meta.revoked) return { valid: false, reason: 'revoked' };
  if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, meta };
}
