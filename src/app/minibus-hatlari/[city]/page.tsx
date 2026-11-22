import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import MinibusDistrictDirectory from '@/components/minibus/MinibusDistrictDirectory';
import StructuredData from '@/components/seo/StructuredData';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DataSourceNotice from '@/components/ui/DataSourceNotice';
import minibusDistrictSnapshot from '@/data/minibus-districts.snapshot.json';
import { getSupportedMinibusCity } from '@/lib/minibusData';
import { buildMinibusCityLandingEntries, parseMinibusDirectoryPayload } from '@/lib/minibusDirectory';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getSupportedMinibusCity(citySlug);
  if (!city) return { title: 'Minibüs Hatları Bulunamadı', robots: { index: false, follow: false } };

  const description = `${city.name} ilçelerine göre minibüs ve taksi dolmuş hatları.`;
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

  const districtEntries = buildMinibusCityLandingEntries(
    parseMinibusDirectoryPayload(minibusDistrictSnapshot),
    city.slug,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <StructuredData
        id={`schema-minibus-${city.slug}`}
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${city.name} Minibüs Hatları`,
          description: `${city.name} ilçelerine göre minibüs ve taksi dolmuş hatları`,
          url: `${SITE_URL}/minibus-hatlari/${city.slug}`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: districtEntries.length,
            itemListElement: districtEntries.map(({ district }, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: `${district.name} Minibüs Hatları`,
              url: `${SITE_URL}/minibus-hatlari/${city.slug}/${district.slug}`,
            })),
          },
        }}
      />

      <h1 className="text-xl font-bold text-brand-soft-blue">{city.name} Minibüs Hatları</h1>
      <p className="mt-1 text-sm font-light text-gray-500">
        Minibüs hatlarını görmek için bir ilçe seçin.
      </p>

      <Breadcrumb
        className="my-5"
        items={[
          { label: 'Minibüs Hatları', href: '/minibus-hatlari' },
          { label: city.name },
        ]}
      />

      <MinibusDistrictDirectory cityName={city.name} citySlug={city.slug} districts={districtEntries} />

      <DataSourceNotice
        sources={['ibbMinibus', 'ibbCityMap']}
        note="Hat dizini ve ilçe eşleştirmeleri İBB'nin resmî ulaşım ve şehir haritası kaynaklarından sağlanır."
      />
    </div>
  );
}

