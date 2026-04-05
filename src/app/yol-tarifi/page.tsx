import type { Metadata } from 'next';
import TransitDirectionsClient from '@/components/transit/TransitDirectionsClient';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Yol Tarifi — Toplu Taşıma ile Nasıl Giderim? | Hızlı Ulaşım',
  description:
    'İstanbul toplu taşıma yol tarifi. Gitmek istediğiniz yeri yazın, hangi otobüs, metro veya tramvaya bineceğinizi, nerede ineceğinizi ve yürüme mesafesini öğrenin.',
  alternates: { canonical: 'https://hizliulasim.com/yol-tarifi' },
};

export default function YolTarifiPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Toplu Taşıma Yol Tarifi</h1>
      <p className="text-sm text-gray-500 mb-4">
        Gitmek istediğiniz yeri yazın, konumunuzdan nasıl gideceğinizi adım adım öğrenin.
      </p>

      <nav className="text-xs text-gray-400 mb-5">
        <Link href="/" className="hover:text-brand-orange">Ana Sayfa</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-600">Yol Tarifi</span>
      </nav>

      <TransitDirectionsClient />

      <p className="text-[11px] text-gray-400 mt-8 text-center">
        Rota bilgileri Google Maps verileri kullanılarak sağlanmaktadır.
      </p>
    </div>
  );
}
