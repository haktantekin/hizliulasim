import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BROKEN_DURAK_SLUGS, BROKEN_HAT_SLUGS } from './broken-redirects';

// Cache for redirects
let redirectsCache: Array<{ source: string; destination: string }> | null = null;
let redirectsCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchRedirects() {
  try {
    // Use cached redirects if still valid
    if (redirectsCache && Date.now() - redirectsCacheTime < CACHE_DURATION) {
      return redirectsCache;
    }

    const response = await fetch('https://cms.hizliulasim.com/wp-json/hizliulasim/v1/redirects', {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    
    if (response.ok) {
      redirectsCache = await response.json();
      redirectsCacheTime = Date.now();
      return redirectsCache;
    }
  } catch (error) {
    console.error('Error fetching redirects:', error);
  }
  
  return null;
}

export async function middleware(request: NextRequest) {
  // Get the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Check if the request is HTTP and not localhost
  const protocol = requestHeaders.get('x-forwarded-proto');
  const host = requestHeaders.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Normalize URL: remove www, enforce HTTPS, remove trailing slash — all in one redirect
  const isWww = host.startsWith('www.');
  const isHttp = protocol === 'http' && !host.includes('localhost') && !host.includes('127.0.0.1');
  const hasTrailingSlash = pathname !== '/' && pathname.endsWith('/');

  if (isWww || isHttp || hasTrailingSlash) {
    const url = request.nextUrl.clone();
    if (isWww) url.host = host.replace('www.', '');
    if (isHttp) url.protocol = 'https:';
    if (hasTrailingSlash) url.pathname = pathname.replace(/\/+$/, '');
    return NextResponse.redirect(url, 301);
  }

  // Redirect broken durak/hat detail pages to their list pages
  const durakMatch = pathname.match(/^\/otobus-duraklari\/([^/]+)$/);
  if (durakMatch && BROKEN_DURAK_SLUGS.has(durakMatch[1])) {
    return NextResponse.redirect(new URL('/otobus-duraklari', request.url), 301);
  }
  const hatMatch = pathname.match(/^\/otobus-hatlari\/([^/]+)$/);
  if (hatMatch && BROKEN_HAT_SLUGS.has(hatMatch[1])) {
    return NextResponse.redirect(new URL('/otobus-hatlari', request.url), 301);
  }

  // Check for custom redirects from API
  const redirects = await fetchRedirects();
  if (redirects) {
    const redirect = redirects.find(r => r.source === pathname);
    if (redirect) {
      return NextResponse.redirect(redirect.destination, 301);
    }
  }

  // Protected routes — require auth cookie
  const protectedPaths = ['/profil', '/u/', '/favoriler'];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));
  if (isProtected) {
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
