import { createHmac } from 'crypto';

// Generate a stable, unguessable token for a project ID
// Uses HMAC-SHA256 with SESSION_SECRET so no database needed
export function projectToken(projectId) {
  const secret = process.env.SESSION_SECRET || 'dev-secret';
  return createHmac('sha256', secret)
    .update(`project:${projectId}`)
    .digest('hex');
}

// Verify a token and return the project ID, or null if invalid
// We can't reverse the hash, so we store projectId in the token as prefix
// Format: [projectId]-[hmac8chars] — short enough to be clean, unguessable in practice
export function signProject(projectId) {
  const secret = process.env.SESSION_SECRET || 'dev-secret';
  const mac = createHmac('sha256', secret)
    .update(`project:${projectId}`)
    .digest('hex')
    .substring(0, 24);
  return `${projectId}-${mac}`;
}

export function verifyProject(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('-');
  if (parts.length < 2) return null;
  // Last 24 chars are the mac, everything before the last dash is the ID
  const mac = parts[parts.length - 1];
  const projectId = parts.slice(0, parts.length - 1).join('-');
  if (!projectId || isNaN(projectId)) return null;
  const expected = signProject(projectId).split('-').pop();
  if (mac !== expected) return null;
  return parseInt(projectId, 10);
}
