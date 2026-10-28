import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import StructuredData from '@/components/seo/StructuredData';
import MinibusDetailTabs from '@/components/minibus/MinibusDetailTabs';
import MinibusLineList from '@/components/minibus/MinibusLineList';
import Breadcrumb from '@/components/ui/Breadcrumb';
import {
  getSupportedMinibusCity,
  type MinibusLine,
} from '@/lib/minibusData';
import {
  filterMinibusLinesForDistrict,
  findMinibusDistrict,
  resolveMinibusDirectoryRoute,
} from '@/lib/minibusDirectory';
import {
  fetchMinibusDistricts,
  fetchMinibusFareTariff,
  fetchMinibusLineDetail,
  fetchMinibusLines,
  MINIBUS_DIRECTORY_VERIFIED_AT,
  MINIBUS_DISTRICT_SOURCE_URL,
  MINIBUS_SOURCE_URL,
  MINIBUS_FARE_SOURCE_URL,
} from '@/services/minibus';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

function formatVerificationDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: Promise<{ city: string; slug: string }> };

async function resolveRoute(citySlug: string, slug: string) {
  const [districtsResult, linesResult] = await Promise.allSettled([
    fetchMinibusDistricts(),
    fetchMinibusLines(),
  ]);
  if (districtsResult.status === 'rejected') throw districtsResult.reason;

  const district = findMinibusDistrict(districtsResult.value, citySlug, slug);
  if (district) {
    return {
      route: { kind: 'district' as const, district },
      lines: linesResult.status === 'fulfilled' ? linesResult.value : null,
    };
  }
  if (linesResult.status === 'rejected') throw linesResult.reason;
  return {
    route: resolveMinibusDirectoryRoute(districtsResult.value, linesResult.value, citySlug, slug),
    lines: linesResult.value as MinibusLine[],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, slug } = await params;
  const city = getSupportedMinibusCity(citySlug);
  if (!city) return { title: 'Minibüs Hattı Bulunamadı', robots: { index: false, follow: false } };

  let resolved;
  try {
    resolved = await resolveRoute(citySlug, slug);
  } catch {
    return {
      title: `${city.name} Minibüs Hattı`,
      description: 'Güncel minibüs hattı bilgisi resmî kaynaktan geçici olarak alınamıyor.',
      robots: { index: false, follow: true },
    };
  }
  if (resolved.route.kind === 'district') {
    const { district } = resolved.route;
    const title = `${district.name} Minibüs Hatları`;
    const description = `${district.cityName} ${district.name} ilçesiyle ilişkilendirilmiş doğrulanmış minibüs hatları.`;
    const canonical = `${SITE_URL}/minibus-hatlari/${district.citySlug}/${district.slug}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title: `${title} | Hızlı Ulaşım`,
        description,
        url: canonical,
        type: 'website',
        siteName: 'Hızlı Ulaşım',
        locale: 'tr_TR',
      },
    };
  }
  if (resolved.route.kind !== 'line') {
    return { title: 'Minibüs Hattı Bulunamadı', robots: { index: false, follow: false } };
  }

  const title = `${resolved.route.line.code} ${resolved.route.line.name}`;
  const description = `${city.name} ${resolved.route.line.vehicleTypeLabel.toLocaleLowerCase('tr-TR')} hattı ${resolved.route.line.code}: ${resolved.route.line.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/minibus-hatlari/${city.slug}/${resolved.route.line.slug}` },
    openGraph: {
      title: `${title} | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/minibus-hatlari/${city.slug}/${resolved.route.line.slug}`,
      type: 'article',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
    },
  };
}

export default async function MinibusLineDetailPage({ params }: PageProps) {
  const { city: citySlug, slug } = await params;
  const city = getSupportedMinibusCity(citySlug);
  if (!city) notFound();

  let resolved;
  try {
    resolved = await resolveRoute(citySlug, slug);
  } catch (error) {
    console.error(`${city.name} minibüs hattı çözümleme hatası:`, error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-brand-soft-blue">{city.name} Minibüs Hattı</h1>
        <Breadcrumb
          className="my-5"
          items={[
            { label: 'Minibüs Hatları', href: '/minibus-hatlari' },
            { label: city.name, href: `/minibus-hatlari/${city.slug}` },
            { label: 'Veri alınamadı' },
          ]}
        />
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          Hat kaydı resmî kaynaktan doğrulanamadı. Bu durum hattın bulunmadığı anlamına gelmez; lütfen daha sonra yeniden deneyin.
        </div>
      </div>
    );
  }
  if (resolved.route.kind === 'not-found') notFound();

  if (resolved.route.kind === 'district') {
    const district = resolved.route.district;
    const districtLines = resolved.lines
      ? filterMinibusLinesForDistrict(resolved.lines, district)
      : null;
    const canonical = `${SITE_URL}/minibus-hatlari/${district.citySlug}/${district.slug}`;

    return (
      <div className="container mx-auto px-4 py-8">
        <StructuredData
          id={`schema-minibus-district-${district.citySlug}-${district.slug}`}
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${district.name} Minibüs Hatları`,
            url: canonical,
            isPartOf: {
              '@type': 'CollectionPage',
              name: `${district.cityName} Minibüs Hatları`,
              url: `${SITE_URL}/minibus-hatlari/${district.citySlug}`,
            },
            ...(districtLines ? {
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: districtLines.length,
                itemListElement: districtLines.map((line, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: `${line.code} - ${line.name}`,
                  url: `${SITE_URL}/minibus-hatlari/${district.citySlug}/${line.slug}`,
                })),
              },
            } : {}),
          }}
        />

        <h1 className="text-xl font-bold text-brand-soft-blue">{district.name} Minibüs Hatları</h1>
        <p className="mt-1 text-sm font-light text-gray-500">
          {district.cityName} {district.name} ilçesinden geçen resmî güzergâhlarla ilişkilendirilmiş hatlar.
        </p>

        <Breadcrumb
          className="my-5"
          items={[
            { label: 'Minibüs Hatları', href: '/minibus-hatlari' },
            { label: district.cityName, href: `/minibus-hatlari/${district.citySlug}` },
            { label: district.name },
          ]}
        />

        {districtLines ? (
          <MinibusLineList
            citySlug={district.citySlug}
            lines={districtLines}
            emptyMessage="Bu ilçe için doğrulanmış minibüs hattı bulunamadı."
          />
        ) : (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Bu ilçenin hat listesi resmî kaynaktan geçici olarak alınamıyor. İlçe bağlantısı doğrulanmış snapshot ile açık tutuluyor.
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Hat verisi:{' '}
          <a className="underline hover:text-brand-soft-blue" href={MINIBUS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            İBB Minibüsüm Nerede?
          </a>
          {' · İlçe sınırı: '}
          <a className="underline hover:text-brand-soft-blue" href={MINIBUS_DISTRICT_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            İBB Şehir Haritası
          </a>
          {` · Son geometri doğrulaması: ${formatVerificationDate(MINIBUS_DIRECTORY_VERIFIED_AT)}`}
        </p>
      </div>
    );
  }

  const line = resolved.route.line;
  const [lineDetail, fareTariff] = await Promise.all([
    fetchMinibusLineDetail(line),
    fetchMinibusFareTariff(line.code),
  ]);
  const cachedData = lineDetail.data;
  const infoHtml = lineDetail.cachedLine?.infoHtml ?? line.infoHtml ?? '';
  const canonical = `${SITE_URL}/minibus-hatlari/${city.slug}/${line.slug}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <StructuredData
        id={`schema-minibus-line-${line.slug}`}
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${line.code} ${line.name}`,
          url: canonical,
          isPartOf: {
            '@type': 'CollectionPage',
            name: `${city.name} Minibüs Hatları`,
            url: `${SITE_URL}/minibus-hatlari/${city.slug}`,
          },
        }}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-brand-soft-blue px-3 py-1 text-lg font-bold text-white">
          {line.code}
        </span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-brand-soft-blue">
          {line.vehicleTypeLabel}
        </span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{line.name}</h1>

      <Breadcrumb
        className="my-5"
        items={[
          { label: 'Minibüs Hatları', href: '/minibus-hatlari' },
          { label: city.name, href: `/minibus-hatlari/${city.slug}` },
          { label: line.code },
        ]}
      />

      <MinibusDetailTabs
        lineName={line.name}
        details={cachedData?.details ?? null}
        outboundRoute={cachedData?.outboundRoute ?? []}
        returnRoute={cachedData?.returnRoute ?? []}
        schedule={cachedData?.schedule ?? null}
        stops={cachedData?.stops ?? []}
        stopsVerified={cachedData?.stopsVerified ?? false}
        fareTariff={fareTariff}
        fareSourceUrl={MINIBUS_FARE_SOURCE_URL}
        infoHtml={infoHtml}
      />

      <p className="mt-8 text-xs text-gray-500">
        Kaynak:{' '}
        <a className="underline hover:text-brand-soft-blue" href={MINIBUS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
          İBB Minibüsüm Nerede?
        </a>
      </p>
    </div>
  );
}

