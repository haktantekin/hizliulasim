import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  
  // Redirect www to non-www (canonical URL)
  if (host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = host.replace('www.', '');
    return NextResponse.redirect(url, 301); // Permanent redirect
  }
  
  // Redirect HTTP to HTTPS (only in production, not on localhost)
  if (
    protocol === 'http' && 
    !host.includes('localhost') && 
    !host.includes('127.0.0.1')
  ) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301); // Permanent redirect
  }

  // Check for custom redirects from API
  const redirects = await fetchRedirects();
  if (redirects) {
    const redirect = redirects.find(r => r.source === pathname);
    if (redirect) {
      return NextResponse.redirect(redirect.destination, 301);
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
