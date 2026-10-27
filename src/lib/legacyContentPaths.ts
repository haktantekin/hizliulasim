const LEGACY_CONTENT_ROOTS = new Set(['blog', 'nasil-giderim']);

type WordPressPostLink = {
  slug: string;
  link: string;
};

type FindPostBySlug = (slug: string) => Promise<WordPressPostLink | null>;
type FindRedirectBySource = (pathname: string) => Promise<string | null>;

function getPathSegments(pathname: string): string[] {
  return pathname.toLowerCase().split('/').filter(Boolean);
}

export function isLegacyContentPath(pathname: string): boolean {
  const [rootSegment] = getPathSegments(pathname);
  return LEGACY_CONTENT_ROOTS.has(rootSegment);
}

export function hasLegacyContentSegment(pathname: string): boolean {
  return getPathSegments(pathname).some(segment => LEGACY_CONTENT_ROOTS.has(segment));
}

export async function resolveLegacyPostDestination(
  pathname: string,
  findPostBySlug: FindPostBySlug,
  findRedirectBySource?: FindRedirectBySource,
): Promise<string | null> {
  const segments = getPathSegments(pathname);
  const legacySegmentIndex = segments.findIndex(segment => LEGACY_CONTENT_ROOTS.has(segment));
  if (legacySegmentIndex < 0 || legacySegmentIndex === segments.length - 1) return null;

  const slug = segments.at(-1);
  if (!slug) return null;

  const post = await findPostBySlug(slug);
  if (post && post.slug.toLowerCase() === slug) {
    try {
      const postUrl = new URL(post.link);
      const destination = postUrl.pathname.replace(/\/+$/, '') || '/';
      if (['http:', 'https:'].includes(postUrl.protocol) && !hasLegacyContentSegment(destination)) {
        return destination;
      }
    } catch {
      // Fall through to the explicit CMS redirect lookup.
    }
  }

  return findRedirectBySource ? findRedirectBySource(pathname) : null;
}
