'use client';

import { useReducer } from 'react';
import Image from 'next/image';
import { MapPin, Star, ExternalLink, Loader2 } from 'lucide-react';

interface Attraction {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  distance: number;
  photo: string | null;
  rating?: number;
  ratingsCount?: number;
  types: string[];
  mapsUrl: string;
  step?: number;
  estimatedDuration?: string;
}

interface AttractionsResponse {
  district: string;
  city: string;
  center: { lat: number; lng: number };
  places: Attraction[];
  route?: Attraction[];
  totalDistance?: string;
}

interface GeziState {
  selectedDistrict: string;
  loading: boolean;
  data: AttractionsResponse | null;
  error: string | null;
  viewMode: 'grid' | 'route';
}

type GeziAction =
  | { type: 'SET_DISTRICT'; value: string }
  | { type: 'SET_VIEW_MODE'; value: 'grid' | 'route' }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; data: AttractionsResponse }
  | { type: 'SEARCH_FAIL'; error: string }
  | { type: 'SET_ERROR'; error: string };

function geziReducer(state: GeziState, action: GeziAction): GeziState {
  switch (action.type) {
    case 'SET_DISTRICT':
      return { ...state, selectedDistrict: action.value };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.value };
    case 'SEARCH_START':
      return { ...state, loading: true, error: null, data: null };
    case 'SEARCH_SUCCESS':
      return { ...state, loading: false, data: action.data };
    case 'SEARCH_FAIL':
      return { ...state, loading: false, error: action.error };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

// İstanbul districts list
const istanbulDistricts = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu'
];

export default function GeziPage() {
  const [state, dispatch] = useReducer(geziReducer, {
    selectedDistrict: '',
    loading: false,
    data: null,
    error: null,
    viewMode: 'route',
  });

  const handleSearch = async () => {
    if (!state.selectedDistrict) {
      dispatch({ type: 'SET_ERROR', error: 'Lütfen bir ilçe seçin' });
      return;
    }

    dispatch({ type: 'SEARCH_START' });

    try {
      const res = await fetch(
        `/api/places/attractions?district=${encodeURIComponent(state.selectedDistrict)}&city=İstanbul`
      );
      
      if (!res.ok) {
        throw new Error('Gezilecek yerler yüklenemedi');
      }

      const result = await res.json();
      dispatch({ type: 'SEARCH_SUCCESS', data: result });
    } catch (err) {
      dispatch({ type: 'SEARCH_FAIL', error: err instanceof Error ? err.message : 'Bir hata oluştu' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-dark-blue mb-2">
          Gezilecek Yerler
        </h1>
        <p className="text-gray-600">
          İlçenizi seçin, size en yakın turistik yerleri ve ilgi çekici noktaları keşfedin
        </p>
      </div>

      {/* District Selector */}
      <div className="bg-white rounded-xl shadow-sm mb-8">
        <label htmlFor="district-select" className="block text-sm font-medium text-gray-700 mb-2">
          İlçe Seçin
        </label>
        <div className="flex gap-3">
          <select
            id="district-select"
            value={state.selectedDistrict}
            onChange={(e) => dispatch({ type: 'SET_DISTRICT', value: e.target.value })}
            className="flex-1 px-4 py-3 border border-brand-light-blue rounded-lg focus:ring-2 focus:ring-brand-soft-blue focus:border-transparent outline-none"
          >
            <option value="">İlçe seçin...</option>
            {istanbulDistricts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={state.loading || !state.selectedDistrict}
            className="px-6 py-3 bg-brand-soft-blue text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {state.loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Aranıyor...
              </>
            ) : (
              'Ara'
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
          {state.error}
        </div>
      )}

      {/* Results */}
      {state.data && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {state.data.district} - Gezilecek Yerler
            </h2>
            <p className="text-gray-600 mt-1">
              {state.data.places.length} sonuç bulundu
              {state.data.route && state.data.totalDistance && (
                <span className="ml-2">• Toplam mesafe: {state.data.totalDistance} km</span>
              )}
            </p>
          </div>

          {/* View Toggle - Moved to bottom */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', value: 'route' })}
                className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  state.viewMode === 'route'
                    ? 'bg-white text-brand-soft-blue shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🗺️ Rota Önerisi
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', value: 'grid' })}
                className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  state.viewMode === 'grid'
                    ? 'bg-white text-brand-soft-blue shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📍 Tüm Yerler
              </button>
            </div>
          </div>

          {state.data.places.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <p className="text-gray-600">
                Bu bölgede kayıtlı gezilecek yer bulunamadı.
              </p>
            </div>
          ) : state.viewMode === 'route' && state.data.route ? (
            /* Timeline Route View */
            <div className="max-w-4xl mx-auto">
              <div className="bg-brand-soft-blue/10 border border-brand-soft-blue/30 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-brand-dark-blue mb-1">
                  🗺️ Önerilen Gezi Rotası
                </h3>
                <p className="text-sm text-gray-600">
                  En yakın yerden başlayarak mesafe sırasına göre sıralanmış rotamız. Her durak için tahmini süre verilmiştir.
                </p>
              </div>

              <div className="space-y-6">
                {state.data.route.map((place, index) => (
                  <div key={place.id} className="relative">
                    {/* Timeline Line */}
                    {index < state.data!.route!.length - 1 && (
                      <div className="absolute left-6 top-24 bottom-0 w-0.5 bg-gradient-to-b from-brand-soft-blue to-brand-soft-blue/30 -mb-6" />
                    )}

                    <div className="flex gap-4">
                      {/* Step Number */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-brand-soft-blue text-white flex items-center justify-center font-bold text-lg shadow-md">
                          {place.step}
                        </div>
                      </div>

                      {/* Card */}
                      <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row">
                          {/* Image */}
                          <div className="relative w-full md:w-48 h-48 bg-gray-200 flex-shrink-0">
                            {place.photo ? (
                              <Image
                                src={place.photo}
                                alt={place.name}
                                fill
                                className="object-cover"
                                unoptimized
                                sizes="(max-width: 768px) 100vw, 192px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <MapPin className="w-12 h-12 text-gray-400" />
                              </div>
                            )}
                            <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full shadow-sm text-sm font-medium">
                              {place.distance} km
                            </div>
                            {place.estimatedDuration && (
                              <div className="absolute bottom-3 left-3 bg-brand-dark-blue text-white px-3 py-1 rounded-full shadow-sm text-sm font-medium">
                                ⏱️ {place.estimatedDuration}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 p-5">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-xl text-gray-900 flex-1">
                                {place.name}
                              </h3>
                              {place.rating && (
                                <div className="flex items-center gap-1 ml-3">
                                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                  <span className="font-semibold">{place.rating}</span>
                                  {place.ratingsCount && (
                                    <span className="text-sm text-gray-500">
                                      ({place.ratingsCount})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <p className="text-gray-600 mb-3 text-sm">
                              {place.address}
                            </p>

                            {/* Types */}
                            {place.types && place.types.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {place.types.slice(0, 4).map((type) => (
                                  <span
                                    key={type}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full"
                                  >
                                    {type.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}

                            <a
                              href={place.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-brand-soft-blue hover:underline font-medium"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Google Maps&apos;te Aç
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.data.places.map((place) => (
                <div
                  key={place.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-200">
                    {place.photo ? (
                      <Image
                        src={place.photo}
                        alt={place.name}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <MapPin className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    {/* Distance Badge */}
                    <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full shadow-sm text-sm font-medium">
                      {place.distance} km
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                      {place.name}
                    </h3>
                    
                    {/* Rating */}
                    {place.rating && (
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{place.rating}</span>
                        {place.ratingsCount && (
                          <span className="text-sm text-gray-500">
                            ({place.ratingsCount})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Address */}
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {place.address}
                    </p>

                    {/* Types */}
                    {place.types && place.types.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {place.types.slice(0, 3).map((type) => (
                          <span
                            key={type}
                            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                          >
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Google Maps Link */}
                    <a
                      href={place.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-brand-soft-blue hover:underline text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Google Maps&apos;te Aç
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
