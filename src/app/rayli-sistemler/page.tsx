import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DataSourceNotice from '@/components/ui/DataSourceNotice';
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

      <DataSourceNotice
        sources={['metroIstanbul']}
        note="Hat, istasyon, sefer ve hizmet durumu bilgileri Metro İstanbul kaynağından sağlanır."
      />
    </div>
  );
}
