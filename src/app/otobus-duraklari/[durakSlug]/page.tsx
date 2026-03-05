import type { Metadata } from 'next';
import { getDurak } from '@/services/iett';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DurakHatlarClient from '@/components/bus/DurakHatlarClient';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { parseDurakSlug } from '@/lib/slugify';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const revalidate = 3600; // 1 hour cache

export async function generateMetadata({
  params,
}: {
  params: Promise<{ durakSlug: string }>;
}): Promise<Metadata> {
  const { durakSlug } = await params;
  const durakKodu = parseDurakSlug(durakSlug);
  const duraklar = await getDurak(durakKodu);
  const durak = duraklar.length > 0 ? duraklar[0] : null;

  const durakAdi = durak?.SDURAKADI || durakKodu;
  const title = `${durakAdi} Durağı - Geçen Otobüs Hatları`;
  const description = `İETT ${durakAdi} durağından geçen tüm otobüs hatları, güzergah bilgileri ve sefer saatleri.${durak?.ILCEADI ? ` İlçe: ${durak.ILCEADI}` : ''}`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-duraklari/${durakSlug}` },
    openGraph: {
      title: `${durakAdi} Durağı | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/otobus-duraklari/${durakSlug}`,
      type: 'website',
    },
  };
}

export default async function DurakDetayPage({
  params,
}: {
  params: Promise<{ durakSlug: string }>;
}) {
  const { durakSlug } = await params;
  const durakKodu = parseDurakSlug(durakSlug);

  const duraklar = await getDurak(durakKodu);
  const durak = duraklar.length > 0 ? duraklar[0] : null;

  if (!durak) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          className="mb-4"
          items={[{ label: 'Otobüs Durakları', href: '/otobus-duraklari' }]}
        />
        <div className="text-center py-16">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Durak Bulunamadı</h1>
          <p className="text-gray-500">
            <span className="font-mono">{durakKodu}</span> kodlu durak bulunamadı.
          </p>
          <Link
            href="/otobus-hatlari"
            className="inline-block mt-6 px-6 py-3 bg-brand-soft-blue text-white rounded-lg hover:bg-brand-dark-blue transition-colors"
          >
            Otobüs Hatlarına Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        className="mb-4"
        items={[
          { label: 'Otobüs Durakları', href: '/otobus-duraklari' },
          { label: durak.SDURAKADI },
        ]}
      />

      {/* Durak Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-brand-soft-blue/10 rounded-full p-3 flex-shrink-0">
            <MapPin className="w-8 h-8 text-brand-soft-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{durak.SDURAKADI}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {durak.ILCEADI && <span>{durak.ILCEADI}</span>}
              {durak.DURAKTIPI && <span>Tip: {durak.DURAKTIPI}</span>}
              {durak.ENGELLIKULLANIMI === 'E' && (
                <span className="text-green-600">♿ Engelli erişimi var</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Geçen Hatlar - loaded client-side to avoid SSR timeout */}
      <DurakHatlarClient durakKodu={durakKodu} durakAdi={durak.SDURAKADI} />
    </div>
  );
}
