import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BROKEN_DURAK_SLUGS, BROKEN_HAT_SLUGS } from './broken-redirects';
import { isLegacyContentPath, resolveLegacyPostDestination } from './lib/legacyContentPaths';
import { getCanonicalRequestUrl } from './lib/canonicalRequestUrl';

type RedirectRule = { source: string; destination: string };
type WordPressPostLink = { slug: string; link: string };

const WP_API_URL = (process.env.NEXT_PUBLIC_WP_API_URL || 'https://cms.hizliulasim.com/wp-json/wp/v2').replace(/\/+$/, '');

function normalizeRedirectSource(source: string): string {
  return source.startsWith('/') ? source : `/${source}`;
}

async function fetchRedirect(pathname: string): Promise<RedirectRule | null> {
  try {
    const endpoint = new URL('https://cms.hizliulasim.com/wp-json/hizliulasim/v1/redirects');
    endpoint.searchParams.set('source', pathname);

    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const redirects = await response.json() as RedirectRule[];
      return redirects.find(rule => normalizeRedirectSource(rule.source) === pathname) ?? null;
    }
  } catch (error) {
    console.error('Error fetching redirect:', error);
  }

  return null;
}

async function fetchLegacyPostDestination(pathname: string): Promise<string | null> {
  try {
    return await resolveLegacyPostDestination(pathname, async (slug) => {
      const endpoint = new URL(`${WP_API_URL}/posts`);
      endpoint.searchParams.set('slug', slug);
      endpoint.searchParams.set('per_page', '1');
      endpoint.searchParams.set('_fields', 'slug,link');

      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const posts = await response.json() as WordPressPostLink[];
      return posts.find(post => post.slug.toLowerCase() === slug) ?? null;
    });
  } catch (error) {
    console.error('Error resolving legacy post URL:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Get the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Check if the request is HTTP and not localhost
  const protocol = requestHeaders.get('x-forwarded-proto');
  const host = requestHeaders.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Normalize domain, protocol, trailing slash, and bus route slug in one redirect
  const canonicalRequestUrl = getCanonicalRequestUrl({
    requestUrl: request.url,
    forwardedProtocol: protocol,
    host,
  });
  const hatMatch = pathname.match(/^\/otobus-hatlari\/([^/]+)\/?$/);
  const normalizedHatCode = hatMatch?.[1].toLowerCase();
  const hasNonCanonicalHatCode = Boolean(hatMatch && hatMatch[1] !== normalizedHatCode);
  const isBrokenHat = Boolean(
    normalizedHatCode
    && Array.from(BROKEN_HAT_SLUGS).some((slug) => slug.toLowerCase() === normalizedHatCode),
  );

  if (canonicalRequestUrl || hasNonCanonicalHatCode || isBrokenHat) {
    const url = canonicalRequestUrl ?? request.nextUrl.clone();
    if (isBrokenHat) {
      url.pathname = '/otobus-hatlari';
    } else if (hatMatch && normalizedHatCode) {
      url.pathname = `/otobus-hatlari/${normalizedHatCode}`;
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

  const legacyPostDestination = await fetchLegacyPostDestination(pathname);
  if (legacyPostDestination) {
    const url = request.nextUrl.clone();
    url.pathname = legacyPostDestination;
    return NextResponse.redirect(url, 301);
  }

  // Removed content roots must reach the app's 404 boundary, even if an old CMS redirect exists.
  if (!isLegacyContentPath(pathname)) {
    const redirect = await fetchRedirect(pathname);
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

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
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
