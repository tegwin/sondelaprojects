import { SignJWT } from 'jose';

const COOKIE = 'sondela_admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Small delay to slow brute force attempts
    await new Promise(r => setTimeout(r, 400));

    const validUser = username === process.env.ADMIN_USERNAME;
    const validPass = password === process.env.ADMIN_PASSWORD;

    if (!validUser || !validPass) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Create signed JWT
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET || 'dev-secret-change-in-production'
    );

    const token = await new SignJWT({ admin: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(secret);

    const isProd = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `${COOKIE}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=43200',
    ];
    if (isProd) cookieParts.push('Secure');

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
