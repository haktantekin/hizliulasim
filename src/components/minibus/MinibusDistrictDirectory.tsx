import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';

import type { MinibusDistrict } from '@/lib/minibusDirectory';

export default function MinibusDistrictDirectory({
  cityName,
  citySlug,
  districts,
}: {
  cityName: string;
  citySlug: string;
  districts: Array<{ district: MinibusDistrict; lineCount: number | null }>;
}) {
  if (districts.length === 0) return null;

  return (
    <section aria-labelledby="minibus-districts-heading" className="mb-8">
      <h2 id="minibus-districts-heading" className="mb-3 text-lg font-semibold text-gray-900">
        {cityName} İlçeleri Minibüs Hatları
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {districts.map(({ district, lineCount }) => (
          <Link
            key={`${district.cityId}-${district.id}`}
            href={`/minibus-hatlari/${citySlug}/${district.slug}`}
            className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-brand-soft-blue hover:bg-blue-50/40"
          >
            <span className="rounded-lg bg-blue-50 p-2 text-brand-soft-blue">
              <MapPin size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-900 group-hover:text-brand-soft-blue">{district.name}</span>
              <span className="block text-xs text-gray-500">
                {lineCount === null ? 'Hat sayısı geçici olarak alınamıyor' : `${lineCount} doğrulanmış hat`}
              </span>
            </span>
            <ChevronRight size={17} className="text-gray-300 group-hover:text-brand-soft-blue" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
