import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import RayliSistemlerClient from '@/components/metro/RayliSistemlerClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const metadata: Metadata = {
  title: 'Raylı Sistemler - Metro, Tramvay, Füniküler, Teleferik',
  description:
    'İstanbul raylı sistem hatları: metro, tramvay, füniküler ve teleferik. Canlı hizmet durumu, sefer saatleri, istasyonlar ve duyurular.',
  alternates: { canonical: `${SITE_URL}/rayli-sistemler` },
  openGraph: {
    title: 'İstanbul Raylı Sistemler | Hızlı Ulaşım',
    description:
      'İstanbul metro, tramvay, füniküler ve teleferik hatları. Canlı hizmet durumu ve sefer bilgileri.',
    url: `${SITE_URL}/rayli-sistemler`,
    type: 'website',
  },
};

export default function RayliSistemlerPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-gray-900">
            İstanbul Raylı Sistemler
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Metro, tramvay, füniküler ve teleferik hatları – canlı hizmet durumu,
          sefer saatleri ve istasyon bilgileri.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[{ label: 'Raylı Sistemler' }]}
      />

      <RayliSistemlerClient />

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
