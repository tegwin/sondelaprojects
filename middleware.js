import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

const COOKIE = 'sondela_admin';

function secret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET || 'dev-secret-please-set-SESSION_SECRET-in-vercel'
  );
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // These routes are always public - no login needed
  if (
    pathname.startsWith('/project/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/project/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next();
  }

  // All other routes require a valid session cookie
  const token = req.cookies.get(COOKIE)?.value;
  if (token) {
    try {
      await jwtVerify(token, secret());
      return NextResponse.next();
    } catch (_) {}
  }

  const url = new URL('/login', req.url);
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
