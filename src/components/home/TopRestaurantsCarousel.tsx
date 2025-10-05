"use client";

import { useEffect, useState } from 'react';
// icons handled inside PlaceCarouselCard
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

const TopRestaurantsCarousel = () => {
  const city = useAppSelector((s) => s.city.name);
  const district = useAppSelector((s) => s.location.district);
  const [items, setItems] = useState<RestaurantItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
  const key = `top-restaurants:${city}:${district || 'ALL'}`;
        const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { ts: number; items: RestaurantItem[] };
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - parsed.ts < sevenDays) {
              setItems(parsed.items || []);
              setLoading(false);
              return;
            }
          } catch {}
        }

  const qs = new URLSearchParams({ city });
  if (district) qs.set('district', district);
        const res = await fetch(`/api/places/top-restaurants?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        try {
          localStorage.setItem(key, JSON.stringify({ ts: Date.now(), items: list }));
        } catch {}
      } catch {
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [city, district]);

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
    <div className="mt-6">
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
