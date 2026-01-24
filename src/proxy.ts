import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;
  
  // Check if the request is coming from iso-coaster.com
  const isCoasterDomain = hostname.includes('iso-coaster.com');
  
  if (isCoasterDomain) {
    // For the root path on iso-coaster.com, rewrite to /coaster
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/coaster', request.url));
    }
    
    // For other paths on iso-coaster.com, you could either:
    // 1. Rewrite to /coaster/... if you have nested routes
    // 2. Keep them as-is for assets and API routes
    // Currently we just let them pass through
  }
  
  return NextResponse.next();
}

// Configure which paths the proxy runs on
export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
