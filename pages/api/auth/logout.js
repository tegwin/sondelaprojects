import { clearSession } from '../../../lib/session';

export default async function handler(req, res) {
  await clearSession(res);
  res.redirect('/login');
}
