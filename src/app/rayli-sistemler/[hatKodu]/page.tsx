import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import MetroHatDetailClient from '@/components/metro/MetroHatDetailClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetLines';

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const res = await fetch(METRO_API);
    if (!res.ok) return [];
    const data = await res.json();
    const lines = Array.isArray(data) ? data : data?.Data || [];
    return lines
      .filter((l: { Name?: string }) => l.Name)
      .map((l: { Name: string }) => ({
        hatKodu: l.Name,
      }));
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
  const code = hatKodu.toUpperCase();

  const title = `${code} Hattı - İstasyon, Sefer Saatleri ve Güzergah`;
  const description = `İstanbul ${code} raylı sistem hattı: istasyonlar, sefer saatleri, canlı hizmet durumu ve duyurular.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/rayli-sistemler/${code}` },
    openGraph: {
      title: `${code} Hattı | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/rayli-sistemler/${code}`,
      type: 'article',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
    },
  };
}

export default async function MetroHatDetailPage({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}) {
  const { hatKodu } = await params;
  const code = hatKodu.toUpperCase();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-brand-soft-blue text-white text-lg font-bold px-3 py-1 rounded-lg">
            {code}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {code} Hattı
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Raylı sistem hattı: istasyonlar, sefer saatleri ve canlı hizmet durumu
        </p>
      </div>

      <Breadcrumb
        className="mb-4"
        items={[
          { label: 'Raylı Sistemler', href: '/rayli-sistemler' },
          { label: code },
        ]}
      />

      <MetroHatDetailClient hatKodu={code} />

      <p className="text-xs text-gray-500 text-center mt-6 mb-4">
        Bu sayfadaki bilgiler{' '}
        <a
          href="https://www.metro.istanbul/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-brand-soft-blue"
        >
          Metro İstanbul
        </a>{' '}
        tarafından sağlanmaktadır.
      </p>
    </div>
  );
}
