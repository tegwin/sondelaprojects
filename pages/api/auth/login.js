import { setSession } from '../../../lib/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body || {};
  await new Promise(r => setTimeout(r, 400)); // slow brute force
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    await setSession(res);
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
}
