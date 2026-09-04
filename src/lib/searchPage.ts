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
export const SEARCH_RESULTS_PER_PAGE = 12;
export const BUS_SEARCH_CATEGORY_SLUG = 'otobus-hatlari';

export function normalizeSearchQuery(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return (rawValue || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
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
