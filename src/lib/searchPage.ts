type SearchPost = {
  slug: string;
  categoryIds: number[];
};

type SearchCategory = {
  id: number;
  slug: string;
  parentId?: number;
};

const MAX_SEARCH_QUERY_LENGTH = 100;
const GOOGLE_SITE_SEARCH_DOMAIN = 'hizliulasim.com';
const DEFAULT_GOOGLE_PROGRAMMABLE_SEARCH_ENGINE_ID = 'a451c442f6af04df3';
export const SEARCH_RESULTS_PER_PAGE = 12;
export const BUS_SEARCH_CATEGORY_SLUG = 'otobus-hatlari';

export type SearchMode = 'idle' | 'google' | 'iett';

export function normalizeSearchQuery(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return (rawValue || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
}

export function buildGoogleSearchUrl(query: string): string {
  const normalizedQuery = normalizeSearchQuery(query);
  const params = new URLSearchParams({
    q: `site:${GOOGLE_SITE_SEARCH_DOMAIN} ${normalizedQuery}`.trim(),
  });

  return `https://www.google.com/search?${params.toString()}`;
}

export function buildGoogleProgrammableSearchScriptUrl(engineId: string): string {
  const params = new URLSearchParams({ cx: engineId.trim() });
  return `https://cse.google.com/cse.js?${params.toString()}`;
}

export function resolveGoogleSearchEngineId(configuredEngineId: string | undefined): string {
  return configuredEngineId?.trim() || DEFAULT_GOOGLE_PROGRAMMABLE_SEARCH_ENGINE_ID;
}

export function parseSearchPage(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue || !/^\d+$/.test(rawValue)) return 1;
  const page = Number(rawValue);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseSearchCategory(
  value: string | string[] | undefined,
): typeof BUS_SEARCH_CATEGORY_SLUG | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === BUS_SEARCH_CATEGORY_SLUG ? BUS_SEARCH_CATEGORY_SLUG : undefined;
}

export function shouldUseGoogleSiteSearch(
  query: string,
  categorySlug: typeof BUS_SEARCH_CATEGORY_SLUG | undefined,
): boolean {
  return !categorySlug && normalizeSearchQuery(query).length >= 2;
}

export function getSearchMode(
  query: string,
  categorySlug: typeof BUS_SEARCH_CATEGORY_SLUG | undefined,
): SearchMode {
  if (normalizeSearchQuery(query).length < 2) return 'idle';
  return categorySlug === BUS_SEARCH_CATEGORY_SLUG ? 'iett' : 'google';
}

export function buildBusRouteHref(lineCode: string): string {
  return `/otobus-hatlari/${encodeURIComponent(lineCode.trim().toLocaleLowerCase('tr-TR'))}`;
}

export function buildSearchPostHref(post: SearchPost, categories: SearchCategory[]): string {
  const assignedCategoryIds = new Set(post.categoryIds);
  const assignedCategories = categories.filter((category) => assignedCategoryIds.has(category.id));
  const childCategory = assignedCategories.find((category) => category.parentId);

  if (childCategory?.parentId) {
    const parentCategory = categories.find((category) => category.id === childCategory.parentId);
    if (parentCategory) return `/${parentCategory.slug}/${childCategory.slug}/${post.slug}`;
  }

  const rootCategory = assignedCategories.find((category) => !category.parentId);
  return rootCategory ? `/${rootCategory.slug}/${post.slug}` : `/ulasim-rehberi/${post.slug}`;
}

export function buildSearchPageHref(
  query: string,
  page: number,
  categorySlug?: typeof BUS_SEARCH_CATEGORY_SLUG,
): string {
  const params = new URLSearchParams({ q: query });
  if (categorySlug) params.set('kategori', categorySlug);
  if (page > 1) params.set('page', String(page));
  return `/arama?${params.toString()}`;
}

export function buildSearchRequest(query: string, page: number, categoryId?: number) {
  return {
    search: query,
    per_page: SEARCH_RESULTS_PER_PAGE + 1,
    offset: (page - 1) * SEARCH_RESULTS_PER_PAGE,
    orderby: 'relevance',
    ...(categoryId ? { categoryId } : {}),
  };
}
