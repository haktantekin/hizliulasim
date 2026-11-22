import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DataSourceNotice from '@/components/ui/DataSourceNotice';
import ChargingStationsClient from '@/components/charging/ChargingStationsClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const metadata: Metadata = {
  title: 'Elektrikli Araç Şarj İstasyonları - Yakınımdaki Şarj Noktaları',
  description:
    'İstanbul ve Türkiye genelinde elektrikli araç şarj istasyonları. Yakınınızdaki şarj noktalarını, güç bilgilerini ve soket tiplerini görüntüleyin.',
  alternates: { canonical: `${SITE_URL}/sarj-istasyonlari` },
  openGraph: {
    title: 'Elektrikli Araç Şarj İstasyonları | Hızlı Ulaşım',
    description:
      'Yakınızdaki elektrikli araç şarj istasyonlarını bulun. Güç, soket tipi ve operatör bilgileri.',
    url: `${SITE_URL}/sarj-istasyonlari`,
    type: 'website',
  },
};

export default function SarjIstasyonlariPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-gray-900">
            Elektrikli Araç Şarj İstasyonları
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Yakınızdaki elektrikli araç şarj istasyonlarını bulun. Güç kapasitesi, soket tipi ve yol tarifi bilgileri.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[{ label: 'Şarj İstasyonları' }]}
      />

      <ChargingStationsClient />

      <DataSourceNotice
        sources={['openChargeMap']}
        note="Şarj noktası bilgileri kamu kurumu olmayan Open Charge Map topluluk kaynağından sağlanır."
      />
    </div>
  );
}
