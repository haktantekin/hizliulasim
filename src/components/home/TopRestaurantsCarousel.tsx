"use client";

import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '../../store/hooks';
import PlaceCarouselCard from './PlaceCarouselCard';

interface RestaurantItem {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  address?: string;
  place_id?: string;
  types?: string[];
}

function getLocalStorageCache(key: string): RestaurantItem[] | undefined {
  try {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; items: RestaurantItem[] };
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.ts < sevenDays) return parsed.items || [];
    }
  } catch { /* ignore */ }
  return undefined;
}

const TopRestaurantsCarousel = () => {
  const city = useAppSelector((s) => s.city.name);
  const district = useAppSelector((s) => s.location.district);

  const { data: items = [], isLoading: loading } = useQuery<RestaurantItem[]>({
    queryKey: ['top-restaurants', city, district],
    queryFn: async () => {
      const qs = new URLSearchParams({ city });
      if (district) qs.set('district', district);
      const res = await fetch(`/api/places/top-restaurants?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      const list = Array.isArray(data.items) ? data.items : [];
      try {
        const key = `top-restaurants:${city}:${district || 'ALL'}`;
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), items: list }));
      } catch { /* ignore */ }
      return list;
    },
    initialData: () => getLocalStorageCache(`top-restaurants:${city}:${district || 'ALL'}`),
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
    <div className="mt-6 mb-6">
      <div className="flex items-center justify-between mb-2">
  <h3 className="text-lg font-semibold text-brand-dark-blue">{district || city} Popüler 10 Restoran </h3>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">Restoran bulunamadı.</div>
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

export default TopRestaurantsCarousel;
