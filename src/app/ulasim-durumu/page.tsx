import type { Metadata } from 'next';
import Link from 'next/link';
import UlasimDurumuClient from './UlasimDurumuClient';

export const metadata: Metadata = {
  title: 'İstanbul Ulaşım Durumu ve Güncel Uyarılar',
  description: 'İETT otobüsleri ve Metro İstanbul hatları için güncel ulaşım uyarılarını hat bazında takip edin.',
  alternates: { canonical: 'https://hizliulasim.com/ulasim-durumu' },
};

export default function UlasimDurumuPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <nav aria-label="Sayfa konumu" className="mb-5 text-xs text-gray-600">
        <Link href="/" className="hover:text-brand-orange">Ana Sayfa</Link>
        <span aria-hidden="true" className="mx-1.5">/</span>
        <span aria-current="page" className="text-gray-900">Ulaşım Durumu</span>
      </nav>

      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-brand-dark-blue sm:text-3xl">İstanbul Ulaşım Durumu</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          İETT ve Metro İstanbul hatlarını etkileyen güncel duyuruları tek yerde görün. Uyarılar bilgilendirme amaçlıdır;
          yol tarifleri duyuru metnine göre otomatik değiştirilmez.
        </p>
      </div>

      <UlasimDurumuClient />
    </main>
  );
}
