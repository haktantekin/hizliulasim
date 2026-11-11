import type { Metadata } from 'next';
import Link from 'next/link';
import TransitPlanner from '@/components/transit/TransitPlanner';
import { parseTransitPlannerUrl } from '@/lib/transit/share-url';

export const metadata: Metadata = {
  title: 'Yol Tarifi — Toplu Taşıma ile Nasıl Giderim?',
  description:
    'İstanbul’da toplu taşıma rotanızı İETT GTFS verileriyle planlayın. Alternatif rotaları süre, yürüme ve aktarma sayısına göre karşılaştırın.',
  alternates: { canonical: 'https://hizliulasim.com/yol-tarifi' },
};

type YolTarifiPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function YolTarifiPage({ searchParams }: YolTarifiPageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const initialState = parseTransitPlannerUrl(query);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <nav aria-label="Sayfa konumu" className="mb-5 text-xs text-gray-600">
        <Link href="/" className="hover:text-brand-orange">Ana Sayfa</Link>
        <span aria-hidden="true" className="mx-1.5">/</span>
        <span aria-current="page" className="text-gray-900">Yol Tarifi</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Toplu Taşıma Yol Tarifi</h1>
      <p className="mt-1 mb-5 text-sm text-gray-600">
        Başlangıç ve hedefinizi seçerek İstanbul’daki toplu taşıma seçeneklerini haritada görün.
      </p>

      <TransitPlanner key={JSON.stringify(initialState)} variant="full" initialState={initialState} />

      <p className="mt-6 text-center text-xs text-gray-600">
        Rota hesabında İBB Açık Veri Portalı’ndaki{' '}
        <a href="https://data.ibb.gov.tr/dataset/iett-gtfs-verisi" className="text-brand-soft-blue underline">
          İETT GTFS verisi
        </a>{' '}
        kullanılır.
      </p>
    </main>
  );
}
