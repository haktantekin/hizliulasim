import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BROKEN_DURAK_SLUGS, BROKEN_HAT_SLUGS } from './broken-redirects';
import {
  hasLegacyContentSegment,
  isLegacyContentPath,
  resolveLegacyPostDestination,
} from './lib/legacyContentPaths';
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
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const redirects = await response.json() as RedirectRule[];
      return redirects.find((rule) => normalizeRedirectSource(rule.source) === pathname) ?? null;
    }
  } catch (error) {
    console.error('Error fetching legacy redirect:', error);
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
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;

      const posts = await response.json() as WordPressPostLink[];
      return posts.find((post) => post.slug.toLowerCase() === slug) ?? null;
    });
  } catch (error) {
    console.error('Error resolving legacy post URL:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const protocol = requestHeaders.get('x-forwarded-proto');
  const host = requestHeaders.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Normalize domain, protocol, trailing slash, and bus route slug in one redirect.
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

  // Redirect broken stop detail pages to the bus routes index.
  const durakMatch = pathname.match(/^\/otobus-duraklari\/([^/]+)$/);
  if (durakMatch && BROKEN_DURAK_SLUGS.has(durakMatch[1])) {
    return NextResponse.redirect(new URL('/otobus-hatlari', request.url), 301);
  }

  // Only legacy paths keep runtime lookup semantics; all other CMS redirects are build-time rules.
  const hasLegacySegment = hasLegacyContentSegment(pathname);
  if (hasLegacySegment) {
    const legacyPostDestination = await fetchLegacyPostDestination(pathname);
    if (legacyPostDestination) {
      const url = request.nextUrl.clone();
      url.pathname = legacyPostDestination;
      return NextResponse.redirect(url, 301);
    }

    // Removed legacy roots must reach the app's 404 boundary.
    if (!isLegacyContentPath(pathname)) {
      const redirect = await fetchRedirect(pathname);
      if (redirect) {
        const destination = redirect.destination.startsWith('http')
          ? redirect.destination
          : new URL(redirect.destination, request.url).toString();
        return NextResponse.redirect(destination, 301);
      }
    }
  }

  const protectedPaths = ['/profil', '/u/', '/favoriler'];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
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

export const config = {
  matcher: [
    '/profil/:path*',
    '/favoriler/:path*',
    '/u/:path*',
    '/otobus-duraklari/:path*',
    '/otobus-hatlari/:path*',
    {
      source: '/((?!api(?:/|$)|_next(?:/|$)|favicon.ico|robots.txt|sitemap.xml|sitemaps(?:/|$)|feed.xml|ads.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|css|js|map|txt|xml|json|woff|woff2|ttf|eot)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
