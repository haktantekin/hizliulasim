import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import DataSourceNotice from '@/components/ui/DataSourceNotice';
import ToiletsClient from '@/components/toilets/ToiletsClient';
import { canonicalMetadata } from '@/lib/seoMetadata';

const title = 'Yakınımdaki Tuvaletler';
const description = 'İstanbul ve Türkiye’de halka açık tuvaletleri bulun. Cami, AVM, benzin istasyonu, park ve ulaşım noktalarındaki tuvaletleri haritada görün, konumunuza göre sıralayın.';

export const metadata: Metadata = {
  ...canonicalMetadata('/tuvaletler'),
  title,
  description,
  openGraph: {
    title: `${title} | Hızlı Ulaşım`,
    description,
    url: '/tuvaletler',
    type: 'website',
  },
};

export default function ToiletsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Umumi tuvaletleri, AVM, cami ve benzin istasyonu tuvaletlerini arayın; haritada görün ve konumunuza göre en yakın noktaları bulun.
        </p>
      </div>
      <Breadcrumb className="mb-5" items={[{ label: title }]} />
      <ToiletsClient />
      <DataSourceNotice
        sources={['ibbToilets', 'ibbOpenDataLicense', 'openStreetMap']}
        note="İBB şehir tuvaletleri, OpenStreetMap’te Türkiye genelindeki tuvalet, AVM ve benzin istasyonları ile İstanbul’daki camiler bir araya getirilir."
      />
    </div>
  );
}
