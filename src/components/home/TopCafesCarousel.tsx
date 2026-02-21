"use client";

import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '../../store/hooks';
import PlaceCarouselCard from './PlaceCarouselCard';

interface CafeItem {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  address?: string;
  place_id?: string;
  types?: string[];
}

function getLocalStorageCache(key: string): CafeItem[] | undefined {
  try {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; items: CafeItem[] };
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.ts < sevenDays) return parsed.items || [];
    }
  } catch { /* ignore */ }
  return undefined;
}

const TopCafesCarousel = () => {
  const city = useAppSelector((s) => s.city.name);
  const district = useAppSelector((s) => s.location.district);

  const { data: items = [], isLoading: loading } = useQuery<CafeItem[]>({
    queryKey: ['top-cafes', city, district],
    queryFn: async () => {
      const qs = new URLSearchParams({ city });
      if (district) qs.set('district', district);
      const res = await fetch(`/api/places/top-cafes?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      const list = Array.isArray(data.items) ? data.items : [];
      try {
        const key = `top-cafes:${city}:${district || 'ALL'}`;
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), items: list }));
      } catch { /* ignore */ }
      return list;
    },
    initialData: () => getLocalStorageCache(`top-cafes:${city}:${district || 'ALL'}`),
    staleTime: 1000 * 60 * 10,
  });

  const openDirections = (name?: string) => {
    if (!name) return;
    const destination = district ? `${name} ${district} ${city}` : `${name} ${city}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('My Location')}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openOnMaps = (name?: string) => {
    if (!name) return;
    const query = district ? `${name} in ${district} ${city}` : `${name} in ${city}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mt- mb-6">
      <div className="flex items-center justify-between mb-2">
  <h3 className="text-lg font-semibold text-brand-dark-blue">{district || city} Popüler 10 Kafe</h3>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">Kafe bulunamadı.</div>
      ) : (
        <div className="flex overflow-x-auto gap-3 pb-2">
          {items.map((it) => (
            <PlaceCarouselCard
              key={it.place_id || it.name}
              name={it.name}
              address={it.address}
              rating={it.rating}
              city={city}
              onDirections={() => openDirections(it.name)}
              onOpenMaps={() => openOnMaps(it.name)}
              variant="plain"
              ratingPlacement="below"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TopCafesCarousel;
