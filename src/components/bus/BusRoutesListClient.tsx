'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { IETTHat } from '@/types/iett';
import { Search, Bus, ArrowRight, X, Loader2 } from 'lucide-react';

export default function BusRoutesListClient() {
  const [hatlar, setHatlar] = useState<IETTHat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showCount, setShowCount] = useState(50);

  useEffect(() => {
    let cancelled = false;
    async function fetchHatlar() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch('/api/iett/hatlar');
        if (!res.ok) throw new Error('API error');
        const data: IETTHat[] = await res.json();
        if (cancelled) return;
        // Sort: numeric first, then alphabetical
        data.sort((a, b) => {
          const aNum = parseInt(a.SHATKODU);
          const bNum = parseInt(b.SHATKODU);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          if (!isNaN(aNum)) return -1;
          if (!isNaN(bNum)) return 1;
          return a.SHATKODU.localeCompare(b.SHATKODU, 'tr');
        });
        setHatlar(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHatlar();
    return () => { cancelled = true; };
  }, []);

  const filteredHatlar = useMemo(() => {
    if (!search.trim()) return hatlar;
    const q = search.toUpperCase().trim();
    return hatlar.filter(
      (h) =>
        h.SHATKODU.toUpperCase().includes(q) ||
        h.SHATADI.toUpperCase().includes(q)
    );
  }, [hatlar, search]);

  const visibleHatlar = useMemo(
    () => filteredHatlar.slice(0, showCount),
    [filteredHatlar, showCount]
  );

  const handleLoadMore = useCallback(() => {
    setShowCount((prev) => prev + 50);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    setShowCount(50);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Otobüs hatları yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Hat bilgileri yüklenirken bir hata oluştu.</p>
        <p className="text-sm text-red-500 mt-1">Lütfen daha sonra tekrar deneyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowCount(50);
          }}
          placeholder="Hat kodu veya güzergah adı ile arayın... (örn: 500T, Kadıköy)"
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue"
        />
        {search && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {search ? (
          <span>
            &quot;{search}&quot; için <strong>{filteredHatlar.length}</strong> hat bulundu
          </span>
        ) : (
          <span>Toplam <strong>{hatlar.length}</strong> otobüs hattı</span>
        )}
      </div>

      {/* Results Grid */}
      {filteredHatlar.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Hat bulunamadı</p>
          <p className="text-sm mt-1">Farklı bir arama terimi deneyin</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {visibleHatlar.map((h) => (
              <Link
                key={h.SHATKODU}
                href={`/otobus-hatlari/${h.SHATKODU}`}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 hover:border-brand-soft-blue/30 hover:shadow-sm transition-all group"
              >
                <div className="w-16 text-center">
                  <span className="inline-block bg-brand-soft-blue text-white font-bold text-sm px-2.5 py-1 rounded-lg">
                    {h.SHATKODU}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {h.SHATADI}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{h.HAT_UZUNLUGU.toFixed(1)} km</span>
                    <span>•</span>
                    <span>{Math.round(h.SEFER_SURESI)} dk</span>
                    <span>•</span>
                    <span>{h.TARIFE}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-soft-blue transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Load More */}
          {showCount < filteredHatlar.length && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2.5 bg-brand-soft-blue text-white rounded-xl text-sm font-medium hover:bg-brand-dark-blue transition-colors"
              >
                Daha Fazla Göster ({filteredHatlar.length - showCount} hat daha)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
