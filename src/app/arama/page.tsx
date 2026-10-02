import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bus, Search } from 'lucide-react';

import GoogleProgrammableSearch from '@/components/search/GoogleProgrammableSearch';
import Breadcrumb from '@/components/ui/Breadcrumb';
import {
  BUS_SEARCH_CATEGORY_SLUG,
  buildBusRouteHref,
  buildGoogleSearchUrl,
  getSearchMode,
  normalizeSearchQuery,
  parseSearchCategory,
  resolveGoogleSearchEngineId,
} from '@/lib/searchPage';
import { canonicalMetadata, noIndexMetadata } from '@/lib/seoMetadata';
import { searchHatlar } from '@/services/iett';
import type { IETTHat } from '@/types/iett';

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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const categorySlug = parseSearchCategory(params.kategori);
  const searchMode = getSearchMode(query, categorySlug);
  const googleSearchEngineId = resolveGoogleSearchEngineId(
    process.env.GOOGLE_PROGRAMMABLE_SEARCH_ENGINE_ID,
  );

  let busRoutes: IETTHat[] = [];
  let busSearchFailed = false;

  if (searchMode === 'iett') {
    try {
      busRoutes = await searchHatlar(query);
    } catch {
      busSearchFailed = true;
    }
  }

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
                {searchMode === 'iett' && !busSearchFailed && (
                  <p className="mt-1 text-sm text-gray-500">
                    {busRoutes.length} hat bulundu.
                  </p>
                )}
              </div>
            </div>

            {searchMode === 'google' ? (
              <GoogleProgrammableSearch
                engineId={googleSearchEngineId}
                fallbackHref={buildGoogleSearchUrl(query)}
              />
            ) : busSearchFailed ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="font-medium text-red-700">Hat bilgileri yüklenemedi.</p>
                <p className="mt-1 text-sm text-red-600">
                  İETT servisi geçici olarak yanıt vermiyor olabilir. Lütfen tekrar deneyin.
                </p>
              </div>
            ) : busRoutes.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
                <Bus className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
                <p className="font-medium text-gray-700">Hat bulunamadı.</p>
                <p className="mt-1 text-sm text-gray-500">
                  Farklı bir hat kodu veya güzergâh adı deneyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {busRoutes.map((route) => (
                  <Link
                    key={route.SHATKODU}
                    href={buildBusRouteHref(route.SHATKODU)}
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-all hover:border-brand-soft-blue/30 hover:shadow-sm"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <span className="inline-block rounded-lg bg-brand-soft-blue px-2.5 py-1 text-sm font-bold text-white">
                        {route.SHATKODU}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {route.SHATADI}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                        <span>{Number(route.HAT_UZUNLUGU).toFixed(1)} km</span>
                        <span>{Math.round(Number(route.SEFER_SURESI))} dk</span>
                        <span>{route.TARIFE}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-brand-soft-blue" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
