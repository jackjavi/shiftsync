import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const ADMIN_PATHS  = ['/audit'];
const MANAGER_PATHS = ['/staff', '/analytics', '/overtime'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Token check via cookie (set by client after login)
  const token = request.cookies.get('shiftsync_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based checks via role cookie
  const role = request.cookies.get('shiftsync_role')?.value;

  if (ADMIN_PATHS.some((p) => pathname.includes(p)) && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/schedule', request.url));
  }

  if (
    MANAGER_PATHS.some((p) => pathname.includes(p)) &&
    role !== 'ADMIN' &&
    role !== 'MANAGER'
  ) {
    return NextResponse.redirect(new URL('/schedule', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
