import {
  buildFallbackPostEntries,
  buildSitemapGroups,
  type SitemapCategory,
  type SitemapCmsItem,
  type SitemapFallbackPost,
  type SitemapGroup,
} from './sitemapEngine.ts';

const SITE_URL = 'https://hizliulasim.com';
const API_BASE_URL = 'https://cms.hizliulasim.com/wp-json/wp/v2';
const CMS_FEED_URL = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/sitemap-feed';
const REVALIDATE_SECONDS = 3600;

const STATIC_PATHS = [
  '/',
  '/kategoriler',
  '/harita',
  '/gezi',
  '/kesfet',
  '/iletisim',
  '/gizlilik-politikasi',
  '/cerez-politikasi',
  '/kunye',
];

type SitemapFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

async function fetchCategories(fetchImpl: SitemapFetch, apiBaseUrl: string): Promise<SitemapCategory[]> {
  try {
    const response = await fetchImpl(
      `${apiBaseUrl}/categories?per_page=100&_fields=id,slug,parent,count`,
      { next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!response.ok) return [];
    const categories: SitemapCategory[] = await response.json();
    return Array.isArray(categories) ? categories : [];
  } catch {
    return [];
  }
}

async function fetchCmsItems(fetchImpl: SitemapFetch, cmsFeedUrl: string): Promise<SitemapCmsItem[] | null> {
  try {
    const response = await fetchImpl(cmsFeedUrl, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!response.ok) return null;
    const feed: { items?: SitemapCmsItem[] } = await response.json();
    return Array.isArray(feed.items) ? feed.items : null;
  } catch {
    return null;
  }
}

async function fetchFallbackPosts(
  fetchImpl: SitemapFetch,
  apiBaseUrl: string,
): Promise<SitemapFallbackPost[]> {
  const posts: SitemapFallbackPost[] = [];
  const perPage = 100;

  for (let page = 1; ; page += 1) {
    try {
      const response = await fetchImpl(
        `${apiBaseUrl}/posts?per_page=${perPage}&page=${page}&_fields=slug,modified,categories`,
        { next: { revalidate: REVALIDATE_SECONDS } },
      );
      if (!response.ok) break;
      const batch: SitemapFallbackPost[] = await response.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      posts.push(...batch);
      if (batch.length < perPage) break;
    } catch {
      break;
    }
  }
  return posts;
}

export async function loadSitemapGroups({
  baseUrl = SITE_URL,
  apiBaseUrl = API_BASE_URL,
  cmsFeedUrl = CMS_FEED_URL,
  fetchImpl = fetch,
  getBusCodes,
}: {
  baseUrl?: string;
  apiBaseUrl?: string;
  cmsFeedUrl?: string;
  fetchImpl?: SitemapFetch;
  getBusCodes: () => Promise<string[]>;
}): Promise<SitemapGroup[]> {
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  const [categories, cmsFeedItems, busCodes] = await Promise.all([
    fetchCategories(fetchImpl, normalizedApiBaseUrl),
    fetchCmsItems(fetchImpl, cmsFeedUrl),
    getBusCodes().catch(() => []),
  ]);

  const cmsItems = cmsFeedItems ?? buildFallbackPostEntries({
    baseUrl,
    categories,
    posts: await fetchFallbackPosts(fetchImpl, normalizedApiBaseUrl),
  });

  return buildSitemapGroups({
    baseUrl,
    staticPaths: STATIC_PATHS,
    categories,
    cmsItems,
    busCodes,
  });
}
