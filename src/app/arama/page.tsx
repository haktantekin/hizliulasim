import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';

import PostListItem from '@/components/blog/PostListItem';
import Breadcrumb from '@/components/ui/Breadcrumb';
import {
  BUS_SEARCH_CATEGORY_SLUG,
  buildSearchPageHref,
  buildSearchPostHref,
  buildSearchRequest,
  normalizeSearchQuery,
  parseSearchCategory,
  parseSearchPage,
  SEARCH_RESULTS_PER_PAGE,
} from '@/lib/searchPage';
import { canonicalMetadata, noIndexMetadata } from '@/lib/seoMetadata';
import { fetchCategories, fetchPosts } from '@/services/wordpress';
import type { BlogCategory, BlogPost } from '@/types/WordPress';

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    kategori?: string | string[];
  }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const categorySlug = parseSearchCategory(params.kategori);
  const title = query
    ? `“${query}” ${categorySlug ? 'Otobüs Hatları ' : ''}Arama Sonuçları`
    : 'Arama';

  return {
    ...canonicalMetadata('/arama'),
    ...noIndexMetadata,
    title,
    description: query
      ? `Hızlı Ulaşım sitesinde “${query}” için bulunan içerikler.`
      : 'Hızlı Ulaşım içeriklerinde arama yapın.',
  };
}

function findDisplayCategory(post: BlogPost, categories: BlogCategory[]): BlogCategory | undefined {
  const assignedIds = new Set(post.categoryIds);
  const assigned = categories.filter((category) => assignedIds.has(category.id));
  return assigned.find((category) => category.parentId)
    ?? assigned.find((category) => !category.parentId);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const currentPage = parseSearchPage(params.page);
  const categorySlug = parseSearchCategory(params.kategori);

  let posts: BlogPost[] = [];
  let categories: BlogCategory[] = [];

  if (query.length >= 2) {
    if (categorySlug) {
      categories = await fetchCategories();
      const categoryId = categories.find((category) => category.slug === categorySlug)?.id;
      posts = categoryId
        ? await fetchPosts(buildSearchRequest(query, currentPage, categoryId))
        : [];
    } else {
      [posts, categories] = await Promise.all([
        fetchPosts(buildSearchRequest(query, currentPage)),
        fetchCategories(),
      ]);
    }
  }

  const hasNextPage = posts.length > SEARCH_RESULTS_PER_PAGE;
  const results = posts.slice(0, SEARCH_RESULTS_PER_PAGE);

  return (
    <main className="container mx-auto min-h-[60vh] px-4 py-8">
      <Breadcrumb items={[{ label: 'Arama' }]} className="mb-5" />

      <section className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-brand-soft-blue">Sitede Ara</h1>
        <p className="mt-2 text-sm text-gray-500">
          Hızlı Ulaşım&apos;daki rehberleri, mekânları ve diğer içerikleri arayın.
        </p>

        <form action="/arama" method="get" role="search" className="mt-5 flex gap-2">
          {categorySlug && (
            <input type="hidden" name="kategori" value={BUS_SEARCH_CATEGORY_SLUG} />
          )}
          <label htmlFor="site-search" className="sr-only">Arama terimi</label>
          <input
            id="site-search"
            name="q"
            type="search"
            defaultValue={query}
            minLength={2}
            maxLength={100}
            required
            placeholder="Sitede ara..."
            className="min-w-0 flex-1 rounded-full border border-brand-light-blue px-5 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-soft-blue focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-soft-blue px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Search size={18} aria-hidden="true" />
            Ara
          </button>
        </form>

        {!query && (
          <div className="mt-8 rounded-xl border border-brand-light-blue/50 bg-blue-50/40 p-5 text-sm text-gray-600">
            Aramak istediğiniz konuyu en az iki karakterle yazın.
          </div>
        )}

        {query.length === 1 && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Arama terimi en az iki karakter olmalıdır.
          </div>
        )}

        {query.length >= 2 && (
          <section className="mt-8" aria-labelledby="search-results-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="search-results-title" className="text-xl font-bold text-gray-900">
                  “{query}” için {categorySlug ? 'Otobüs Hatları sonuçları' : 'sonuçlar'}
                </h2>
                {results.length > 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    {currentPage}. sayfada {results.length} içerik gösteriliyor.
                  </p>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
                <p className="font-medium text-gray-700">Sonuç bulunamadı.</p>
                <p className="mt-1 text-sm text-gray-500">
                  Daha kısa veya farklı bir arama terimi deneyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {results.map((post) => {
                  const category = findDisplayCategory(post, categories);
                  return (
                    <PostListItem
                      key={post.id}
                      post={post}
                      href={buildSearchPostHref(post, categories)}
                      categorySlug={category?.slug}
                      categoryName={category?.name}
                    />
                  );
                })}
              </div>
            )}

            {(currentPage > 1 || hasNextPage) && (
              <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Arama sonuçları sayfaları">
                {currentPage > 1 ? (
                  <Link
                    href={buildSearchPageHref(query, currentPage - 1, categorySlug)}
                    rel="prev"
                    className="rounded-full border border-brand-light-blue px-4 py-2 text-sm font-medium text-brand-soft-blue hover:bg-blue-50"
                  >
                    Önceki sayfa
                  </Link>
                ) : <span />}
                {hasNextPage && (
                  <Link
                    href={buildSearchPageHref(query, currentPage + 1, categorySlug)}
                    rel="next"
                    className="rounded-full bg-brand-soft-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Sonraki sayfa
                  </Link>
                )}
              </nav>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
