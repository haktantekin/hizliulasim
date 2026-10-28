import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPinned } from 'lucide-react';

import StructuredData from '@/components/seo/StructuredData';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { SUPPORTED_MINIBUS_CITIES } from '@/lib/minibusData';
import { fetchMinibusLines, MINIBUS_SOURCE_URL } from '@/services/minibus';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Minibüs Hatları',
  description: 'İstanbul minibüs ve taksi dolmuş hatlarını illere göre inceleyin.',
  alternates: { canonical: `${SITE_URL}/minibus-hatlari` },
  openGraph: {
    title: 'Minibüs Hatları | Hızlı Ulaşım',
    description: 'İstanbul minibüs ve taksi dolmuş hatlarını illere göre inceleyin.',
    url: `${SITE_URL}/minibus-hatlari`,
    type: 'website',
    siteName: 'Hızlı Ulaşım',
    locale: 'tr_TR',
  },
};

export default async function MinibusHatlariPage() {
  let istanbulLineCount: number | null = null;
  let sourceUnavailable = false;

  try {
    istanbulLineCount = (await fetchMinibusLines()).length;
  } catch (error) {
    sourceUnavailable = true;
    console.error('Minibüs ana dizini veri hatası:', error);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <StructuredData
        id="schema-minibus-directory"
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Minibüs Hatları',
          description: 'İllere göre minibüs ve taksi dolmuş hatları',
          url: `${SITE_URL}/minibus-hatlari`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: SUPPORTED_MINIBUS_CITIES.length,
            itemListElement: SUPPORTED_MINIBUS_CITIES.map((city, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: city.name,
              url: `${SITE_URL}/minibus-hatlari/${city.slug}`,
            })),
          },
        }}
      />

      <h1 className="text-xl font-bold text-brand-soft-blue">Minibüs Hatları</h1>
      <p className="mt-1 text-sm font-light text-gray-500">
        Resmî kaynakta içeriği bulunan illeri seçerek minibüs ve taksi dolmuş hatlarını görüntüleyin.
      </p>

      <Breadcrumb className="my-5" items={[{ label: 'Minibüs Hatları' }]} />

      {sourceUnavailable && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Güncel hat sayısı şu anda resmî kaynaktan alınamadı. İl dizinine yine erişebilirsiniz.
        </div>
      )}

      <section aria-labelledby="minibus-cities-heading">
        <h2 id="minibus-cities-heading" className="mb-3 text-lg font-semibold text-gray-900">
          İller
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_MINIBUS_CITIES.map((city) => (
            <Link
              key={city.slug}
              href={`/minibus-hatlari/${city.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-light-blue hover:shadow-sm"
            >
              <span className="rounded-full bg-blue-50 p-3 text-brand-soft-blue">
                <MapPinned size={24} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-gray-900 group-hover:text-brand-soft-blue">
                  {city.name}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {istanbulLineCount === null ? 'Minibüs ve taksi dolmuş hatları' : `${istanbulLineCount} resmî hat ve güzergâh`}
                </span>
              </span>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-soft-blue" />
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-500">
        Hat verileri{' '}
        <a className="underline hover:text-brand-soft-blue" href={MINIBUS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          İBB Minibüsüm Nerede?
        </a>{' '}
        resmî kaynağından alınır.
      </p>
    </div>
  );
}

