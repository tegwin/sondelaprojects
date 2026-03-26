import { SignJWT, jwtVerify } from 'jose';

const COOKIE = 'sondela_admin';

function secret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET || 'dev-secret-please-set-SESSION_SECRET-in-vercel'
  );
}

export async function setSession(res) {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());

  res.setHeader('Set-Cookie', [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=43200',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; '));
}

export async function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}
