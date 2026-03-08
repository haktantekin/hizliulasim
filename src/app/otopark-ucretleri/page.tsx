import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import OtoparkListClient from '@/components/parking/OtoparkListClient';
import { ParkingCircle } from 'lucide-react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const metadata: Metadata = {
  title: 'İstanbul Otopark Ücretleri - İSPARK Anlık Doluluk',
  description:
    'İstanbul İSPARK otoparkları, güncel otopark ücretleri, aylık abonelik fiyatları ve anlık doluluk bilgileri. Açık otopark, kapalı otopark ve yol üstü park alanları.',
  alternates: { canonical: `${SITE_URL}/otopark-ucretleri` },
  openGraph: {
    title: 'İstanbul Otopark Ücretleri | Hızlı Ulaşım',
    description:
      'İstanbul İSPARK otoparkları, güncel ücretler, aylık abonelik fiyatları ve anlık doluluk bilgileri.',
    url: `${SITE_URL}/otopark-ucretleri`,
    type: 'website',
  },
};

export default function OtoparkUcretleriPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-gray-900">
            İstanbul Otopark Ücretleri
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          İSPARK otoparkları anlık doluluk bilgileri ve güncel ücret tarifeleri.
          Bir otoparka tıklayarak detaylı ücret bilgisini görebilirsiniz.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[{ label: 'Otopark Ücretleri' }]}
      />

      <OtoparkListClient />

      <p className="text-xs text-gray-500 text-center mt-6 mb-4">
        Bu sayfadaki bilgiler anlık olarak{' '}
        <a
          href="https://ispark.istanbul/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-brand-soft-blue"
        >
          İSPARK
        </a>{' '}
        tarafından sağlanmaktadır.
      </p>
    </div>
  );
}
