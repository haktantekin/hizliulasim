'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setDistrict } from '../../store/slices/locationSlice';

const SearchBar = () => {
  const [q, setQ] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedDistrict = useAppSelector((s) => s.location.district);
  const city = useAppSelector((s) => s.city.name);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const effectiveCity = (city && city.trim()) || 'İstanbul';
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/maps/districts?city=${encodeURIComponent(effectiveCity)}&country=TR`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data?.districts)) {
          setDistricts(data.districts);
        } else {
          setDistricts([]);
        }
        if (!res.ok) {
          setError(data?.error || 'İlçeler yüklenemedi');
        }
      } catch {
        if (mounted) {
          setDistricts([]);
          setError('İlçeler yüklenemedi');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [city]);

  const doSearch = useCallback(() => {
    const query = q.trim();
    if (!query) return;
    const parts = [query];
    if (selectedDistrict) parts.push(selectedDistrict);
    if (city) parts.push(city);
    const destination = parts.join(' ');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('My Location')}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [q, selectedDistrict, city]);

  return (
    <div className="flex flex-row gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
          placeholder="Nereye gidelim?"
          className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-400 placeholder-gray-500 transition-colors"
        />
        <button
          type="button"
          onClick={doSearch}
          aria-label="Google Haritalar'da ara"
          className="absolute right-1.5 top-1.5 h-9 w-9 text-white flex items-center justify-center hover:opacity-90"
        >
          <Search size={18} color='#121212' />
        </button>
      </div>
      <div className="flex-1 relative">
        <select
          value={selectedDistrict}
          onChange={(e) => dispatch(setDistrict(e.target.value))}
          className="w-full border border-brand-light-blue rounded-full px-3 pr-10 py-3 text-gray-400 appearance-none"
          aria-label="İlçe seçiniz"
          disabled={loading}
        >
          <option value="">{loading ? 'İlçeler yükleniyor…' : 'İlçe Seçiniz'}</option>
          {!loading && districts.length === 0 && (
            <option value="" disabled>
              İlçe bulunamadı
            </option>
          )}
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-blue"
          aria-hidden
        />
        {!loading && error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
