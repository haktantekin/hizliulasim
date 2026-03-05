'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bus, ArrowRight, Loader2 } from 'lucide-react';

interface GecenHat {
  hatKodu: string;
  hatAdi: string;
  yon: string;
  sirano: number;
}

export default function DurakHatlarClient({ durakKodu, durakAdi }: { durakKodu: string; durakAdi: string }) {
  const [hatlar, setHatlar] = useState<GecenHat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/iett/durak-hatlar?kod=${durakKodu}`)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data: GecenHat[]) => {
        if (!cancelled) setHatlar(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [durakKodu]);

  return (
    <div className="mb-6">
      <h2 className="text-basetext-brand-soft-blue mb-4 flex flex-col items-center gap-2">
        {durakAdi} Durağından Geçen Otobüs Hatları
        {!loading && <span className="text-sm font-normal text-gray-400">({hatlar.length} hat)</span>}
      </h2>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Geçen hatlar aranıyor… Bu işlem biraz zaman alabilir.</span>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Bus className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Geçen hat bilgisi alınamadı.</p>
        </div>
      )}

      {!loading && !error && hatlar.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Bus className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Bu duraktan geçen hat bilgisi bulunamadı.</p>
        </div>
      )}

      {!loading && !error && hatlar.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hatlar.map((hat) => (
            <Link
              key={`${hat.hatKodu}-${hat.yon}`}
              href={`/otobus-hatlari/${hat.hatKodu}`}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-4 hover:border-brand-soft-blue/30 hover:shadow-sm transition-all group"
            >
              <div className="bg-brand-orange/10 rounded-lg px-3 py-2 flex-shrink-0">
                <span className="font-bold text-brand-orange text-sm">{hat.hatKodu}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 truncate">{hat.hatAdi}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{hat.yon === 'G' ? 'Gidiş' : 'Dönüş'}</span>
                  <span>•</span>
                  <span>{hat.sirano}. durak</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-soft-blue flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
