import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;
  
  // Check if the request is coming from iso-coaster.com
  const isCoasterDomain = hostname.includes('iso-coaster.com');
  const isCoasterDeployment =
    process.env.NEXT_PUBLIC_GLITCH_GAME_KEY === 'coaster' ||
    process.env.NEXT_PUBLIC_GLITCH_GAME_KEY === 'isocoaster' ||
    process.env.NEXT_PUBLIC_GLITCH_GAME_KEY === 'rollercoaster';
  
  if (isCoasterDomain || isCoasterDeployment) {
    // Glitch launches the deployed container at its root URL. For the coaster
    // title, root must render the coaster app, otherwise the IsoCity page is
    // served inside the IsoRollerCoaster iframe.
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/coaster', request.url));
    }

    // Shared Glitch invite links use ?room=CODE against the public play page,
    // but legacy /coop/CODE links should still land in the coaster co-op route.
    if (pathname.startsWith('/coop/')) {
      return NextResponse.rewrite(new URL(`/coaster${pathname}`, request.url));
    }
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
