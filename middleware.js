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

  // Public routes — no auth needed (token-based project pages)
  if (
    pathname.startsWith('/p/') ||          // public project pages (token URLs)
    pathname.startsWith('/project/') ||    // keep old route working for now
    pathname.startsWith('/client/') ||     // client overview pages
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/p/') ||      // public project API (token-verified internally)
    pathname.startsWith('/api/collab/') ||  // collaboration (token-verified internally)
    pathname.startsWith('/api/ical/') ||    // iCal feed (token-verified internally)
    pathname.startsWith('/api/attachments/') || // attachments (token-verified internally)
    pathname.startsWith('/certificate/') || // completion certificate (public)
    pathname.startsWith('/proposal/') ||    // proposal mode (public)
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/project/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next();
  }

  // Everything else needs admin session
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
