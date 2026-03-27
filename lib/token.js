import { createHmac } from 'crypto';

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
  const mac = parts[parts.length - 1];
  const projectId = parts.slice(0, parts.length - 1).join('-');
  if (!projectId || isNaN(projectId)) return null;
  const expected = signProject(projectId).split('-').pop();
  if (mac !== expected) return null;
  return parseInt(projectId, 10);
}
