import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import MinibusLineList from '@/components/minibus/MinibusLineList';
import MinibusDistrictDirectory from '@/components/minibus/MinibusDistrictDirectory';
import StructuredData from '@/components/seo/StructuredData';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { getSupportedMinibusCity } from '@/lib/minibusData';
import { buildMinibusDistrictEntries, resolveMinibusDistrictLoad } from '@/lib/minibusDirectory';
import { fetchMinibusDistricts, fetchMinibusLines, MINIBUS_SOURCE_URL } from '@/services/minibus';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getSupportedMinibusCity(citySlug);
  if (!city) return { title: 'Minibüs Hatları Bulunamadı', robots: { index: false, follow: false } };

  const description = `${city.name} minibüs ve taksi dolmuş hatları, güzergâh adları ve resmî hat kodları.`;
  return {
    title: `${city.name} Minibüs Hatları`,
    description,
    alternates: { canonical: `${SITE_URL}/minibus-hatlari/${city.slug}` },
    openGraph: {
      title: `${city.name} Minibüs Hatları | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/minibus-hatlari/${city.slug}`,
      type: 'website',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
    },
  };
}

export default async function MinibusCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getSupportedMinibusCity(citySlug);
  if (!city) notFound();

  const [linesResult, districtsResult] = await Promise.allSettled([
    fetchMinibusLines(),
    fetchMinibusDistricts(),
  ]);
  const lines = linesResult.status === 'fulfilled' ? linesResult.value : null;
  const districtLoad = resolveMinibusDistrictLoad(districtsResult);
  const districts = districtLoad.status === 'ready'
    ? districtLoad.districts.filter((district) => district.citySlug === city.slug)
    : [];
  if (linesResult.status === 'rejected') {
    console.error(`${city.name} minibüs listesi veri hatası:`, linesResult.reason);
  }
  if (districtLoad.status === 'error') {
    console.error(`${city.name} minibüs ilçe kataloğu veri hatası:`, districtLoad.error);
  }
  const districtEntries = buildMinibusDistrictEntries(lines, districts);

  return (
    <div className="container mx-auto px-4 py-8">
      {lines && (
        <StructuredData
          id={`schema-minibus-${city.slug}`}
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${city.name} Minibüs Hatları`,
            description: `${city.name} minibüs ve taksi dolmuş hatları`,
            url: `${SITE_URL}/minibus-hatlari/${city.slug}`,
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: lines.length,
              itemListElement: lines.slice(0, 100).map((line, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: `${line.code} - ${line.name}`,
                url: `${SITE_URL}/minibus-hatlari/${city.slug}/${line.slug}`,
              })),
            },
          }}
        />
      )}

      <h1 className="text-xl font-bold text-brand-soft-blue">{city.name} Minibüs Hatları</h1>
      <p className="mt-1 text-sm font-light text-gray-500">
        {city.name} genelindeki resmî minibüs ve taksi dolmuş hatları.
      </p>

      <Breadcrumb
        className="my-5"
        items={[
          { label: 'Minibüs Hatları', href: '/minibus-hatlari' },
          { label: city.name },
        ]}
      />

      {districtLoad.status === 'error' && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          İlçe listesi şu anda alınamadı. Genel İstanbul hatları aşağıda gösterilmeye devam ediyor.
        </div>
      )}

      <MinibusDistrictDirectory cityName={city.name} citySlug={city.slug} districts={districtEntries} />

      {lines ? (
        <MinibusLineList cityName={city.name} citySlug={city.slug} lines={lines} />
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          Güncel minibüs hatları resmî kaynaktan alınamadı. Bu durum “hat bulunamadı” anlamına gelmez; lütfen daha sonra yeniden deneyin.
        </div>
      )}

      <p className="mt-8 text-xs text-gray-500">
        Kaynak:{' '}
        <a className="underline hover:text-brand-soft-blue" href={MINIBUS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          İBB Minibüsüm Nerede?
        </a>
      </p>
    </div>
  );
}

