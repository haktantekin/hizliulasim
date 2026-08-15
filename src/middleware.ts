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
  
  // Normalize domain, protocol, trailing slash, and bus route slug in one redirect
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const needsApexDomain = host.startsWith('www.') && !isLocalhost;
  const isHttp = protocol === 'http' && !isLocalhost;
  const hasTrailingSlash = pathname !== '/' && pathname.endsWith('/');
  const isHierarchicalPostPath = /^\/(?!api\/)[^/]+\/[^/]+\/[^/]+$/.test(pathname);
  const hatMatch = pathname.match(/^\/otobus-hatlari\/([^/]+)\/?$/);
  const normalizedHatCode = hatMatch?.[1].toLowerCase();
  const hasNonCanonicalHatCode = Boolean(hatMatch && hatMatch[1] !== normalizedHatCode);
  const isBrokenHat = Boolean(
    normalizedHatCode
    && Array.from(BROKEN_HAT_SLUGS).some((slug) => slug.toLowerCase() === normalizedHatCode),
  );

  if (needsApexDomain || isHttp || hasTrailingSlash || hasNonCanonicalHatCode || isBrokenHat) {
    const url = request.nextUrl.clone();
    if (needsApexDomain) {
      url.hostname = 'hizliulasim.com';
      url.port = '';
    }
    if (isHttp) url.protocol = 'https:';
    if (isBrokenHat) {
      url.pathname = '/otobus-hatlari';
    } else if (hatMatch && normalizedHatCode) {
      url.pathname = `/otobus-hatlari/${normalizedHatCode}`;
    } else if (hasTrailingSlash) {
      url.pathname = pathname.replace(/\/+$/, '');
    }
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return new NextResponse(null, {
      status: 301,
      headers: { Location: url.toString() },
    });
  }

  // Redirect broken durak/hat detail pages to /otobus-hatlari
  const durakMatch = pathname.match(/^\/otobus-duraklari\/([^/]+)$/);
  if (durakMatch && BROKEN_DURAK_SLUGS.has(durakMatch[1])) {
    return NextResponse.redirect(new URL('/otobus-hatlari', request.url), 301);
  }
  // Check for custom redirects from API
  const redirects = await fetchRedirects();
  if (redirects && !isHierarchicalPostPath) {
    const redirect = redirects.find(r => r.source === pathname);
    if (redirect) {
      const dest = redirect.destination.startsWith('http') ? redirect.destination : new URL(redirect.destination, request.url).toString();
      return NextResponse.redirect(dest, 301);
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
