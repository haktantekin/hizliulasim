'use client';

import { useState, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import Image from 'next/image';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Loader2, Star, ExternalLink, MapPin, Search } from 'lucide-react';

interface AccessiblePlace {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  ratingsCount?: number;
  types: string[];
  wheelchairAccessibleEntrance: boolean | null;
  photo: string | null;
  mapsUrl: string;
}

const CATEGORIES = [
  { label: 'Restoran', value: 'restoran' },
  { label: 'Kafe', value: 'kafe' },
  { label: 'Müze', value: 'müze' },
  { label: 'Hastane', value: 'hastane' },
  { label: 'AVM', value: 'alışveriş merkezi' },
  { label: 'Otel', value: 'otel' },
  { label: 'Park', value: 'park' },
  { label: 'Sinema', value: 'sinema' },
];

export default function EngelsizMekanlarPage() {
  const [places, setPlaces] = useState<AccessiblePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const city = useAppSelector((s) => s.city.name);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, city });
      const res = await fetch(`/api/places/accessible?${params}`);
      if (!res.ok) throw new Error('Veri alınamadı');
      const data = await res.json();
      setPlaces(data.places || []);
    } catch {
      setError('Mekan bilgisi alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, [city]);

  const handleCategoryClick = (value: string) => {
    setSearchQuery(value);
    handleSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">♿</span>
          <h1 className="text-xl font-bold text-gray-900">Engelsiz Mekanlar</h1>
        </div>
        <p className="text-sm text-gray-500">
          {city} genelinde tekerlekli sandalye dostu mekanları keşfedin.
          Giriş, park alanı ve tuvalet erişilebilirlik bilgileri.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[
          { label: 'Engelsiz Erişim', href: '/engelsiz-erisim' },
          { label: 'Engelsiz Mekanlar' },
        ]}
      />

      {/* Search */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mekan ara (ör: restoran, müze, kafe)..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-brand-dark-blue text-white rounded-lg text-sm hover:opacity-90"
        >
          Ara
        </button>
      </form>

      {/* Quick categories */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
          >
            ♿ {cat.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-soft-blue" />
          <span className="ml-2 text-gray-500">Mekanlar aranıyor...</span>
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500">{error}</div>
      )}

      {!loading && searched && places.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          Sonuç bulunamadı. Farklı bir arama deneyin.
        </div>
      )}

      {!loading && places.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {places.map((place) => (
            <div
              key={place.id}
              className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {place.photo && (
                <div className="relative w-full h-40">
                  <Image
                    src={place.photo}
                    alt={place.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{place.name}</h3>
                  {place.rating && (
                    <div className="flex items-center gap-1 text-amber-500 shrink-0">
                      <Star size={14} />
                      <span className="text-sm font-medium">{place.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MapPin size={12} />
                  <span className="line-clamp-1">{place.address}</span>
                </div>

                {/* Accessibility badges */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {place.wheelchairAccessibleEntrance === true && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full border border-green-200">
                      ♿ Erişilebilir giriş
                    </span>
                  )}
                  {place.wheelchairAccessibleEntrance === false && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded-full border border-red-200">
                      ❌ Erişilebilir giriş yok
                    </span>
                  )}
                  {place.wheelchairAccessibleEntrance === null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded-full border border-gray-200">
                      ❓ Erişim bilgisi yok
                    </span>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-brand-dark-blue text-white rounded-full hover:opacity-90"
                  >
                    Yol Tarifi
                  </a>
                  <a
                    href={place.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-gray-100 text-brand-dark-blue rounded-full hover:bg-gray-200 flex items-center gap-1"
                  >
                    Haritada Aç <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl block mb-3">♿</span>
          <p>Yukarıdan bir kategori seçin veya arama yapın.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        Erişilebilirlik verileri Google Places API&apos;den alınmaktadır.
        Lütfen ziyaret öncesinde mekanla iletişime geçerek teyit alınız.
      </p>
    </div>
  );
}
