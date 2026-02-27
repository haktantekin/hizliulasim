import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBusRouteDetail, getHat } from '@/services/iett';
import Breadcrumb from '@/components/ui/Breadcrumb';
import BusRouteDetailClient from '@/components/bus/BusRouteDetailClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
const DEFAULT_IMAGE = 'https://cms.hizliulasim.com/wp-content/uploads/2026/02/otobus-hatlari.jpeg';

export const revalidate = 300; // Revalidate every 5 minutes

// Pre-render all bus routes at build time → no API delay for users
export async function generateStaticParams() {
  try {
    const hatlar = await getHat();
    return hatlar.map((h) => ({ hatKodu: h.SHATKODU }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}): Promise<Metadata> {
  const { hatKodu } = await params;
  const upperCode = hatKodu.toUpperCase();
  const hatlar = await getHat(upperCode);
  const hat = hatlar.length > 0 ? hatlar[0] : null;

  if (!hat) {
    return {
      title: `${upperCode} Otobüs Hattı`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${hat.SHATKODU} ${hat.SHATADI} - Otobüs Güzergahı, Sefer Saatleri`;
  const description = `İETT ${hat.SHATKODU} ${hat.SHATADI} otobüs hattı güzergahı, hareket saatleri, canlı araç konumları ve duyuruları. Hat uzunluğu: ${hat.HAT_UZUNLUGU.toFixed(1)} km, Sefer süresi: ${Math.round(hat.SEFER_SURESI)} dakika.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-hatlari/${hat.SHATKODU}` },
    openGraph: {
      title: `${hat.SHATKODU} ${hat.SHATADI} | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/otobus-hatlari/${hat.SHATKODU}`,
      type: 'article',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
      images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: `${hat.SHATKODU} ${hat.SHATADI}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${hat.SHATKODU} - Otobüs Güzergahı | Hızlı Ulaşım`,
      description,
      images: [DEFAULT_IMAGE],
    },
  };
}

export default async function BusRouteDetailPage({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}) {
  const { hatKodu } = await params;
  const upperCode = hatKodu.toUpperCase();

  const data = await getBusRouteDetail(upperCode);

  if (!data.hat) {
    notFound();
  }

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BusTrip',
    name: `${data.hat.SHATKODU} - ${data.hat.SHATADI}`,
    description: `İETT ${data.hat.SHATKODU} otobüs hattı - ${data.hat.SHATADI}`,
    provider: {
      '@type': 'Organization',
      name: 'İETT - İstanbul Elektrik Tramvay ve Tünel İşletmeleri',
    },
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumb
        className="mb-4"
        items={[
          { label: 'Otobüs Hatları', href: '/otobus-hatlari' },
          { label: data.hat.SHATKODU },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-brand-soft-blue text-white text-lg font-bold px-3 py-1 rounded-lg">
            {data.hat.SHATKODU}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {data.hat.SHATADI}
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          İETT otobüs hattı güzergah bilgileri, sefer saatleri ve canlı araç konumları
        </p>
      </div>

      <BusRouteDetailClient
        hat={data.hat}
        seferler={data.seferler}
        konumlar={data.konumlar}
      />
    </div>
  );
}
