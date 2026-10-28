import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { MinibusLine, MinibusVehicleType } from '@/lib/minibusData';

const GROUPS: Array<{ type: MinibusVehicleType; title: string }> = [
  { type: 'minibus', title: 'Minibüs hatları' },
  { type: 'taksi-dolmus', title: 'Taksi dolmuş hatları' },
];

export default function MinibusLineList({
  cityName,
  citySlug,
  lines,
  emptyMessage = 'Bu il için yayımlanmış minibüs hattı bulunamadı.',
}: {
  cityName?: string;
  citySlug: string;
  lines: MinibusLine[];
  emptyMessage?: string;
}) {
  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const groupLines = lines.filter((line) => line.vehicleType === group.type);
        if (groupLines.length === 0) return null;

        return (
          <section key={group.type} aria-labelledby={`minibus-group-${group.type}`}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id={`minibus-group-${group.type}`} className="text-lg font-semibold text-gray-900">
                {group.type === 'minibus' && cityName ? `${cityName} Minibüs Hatları` : group.title}
              </h2>
              <span className="text-xs text-gray-500">{groupLines.length} hat</span>
            </div>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {groupLines.map((line) => (
                <Link
                  key={`${line.vehicleType}-${line.slug}`}
                  href={`/minibus-hatlari/${citySlug}/${line.slug}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-14 rounded-md bg-brand-soft-blue px-2 py-1 text-center text-xs font-bold text-white">
                    {line.code}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-gray-800 group-hover:text-brand-soft-blue">
                    {line.name}
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-gray-300 group-hover:text-brand-soft-blue" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

