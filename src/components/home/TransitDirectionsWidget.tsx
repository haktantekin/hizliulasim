'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Loader2, MapPin, Clock,
  Footprints, Bus, TrainFront, ArrowDown, X, AlertCircle, Navigation,
} from 'lucide-react';
import Link from 'next/link';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

interface TransitInfo {
  line: string;
  lineName: string;
  vehicleType: string;
  color: string;
  textColor: string;
  departureStop: string;
  arrivalStop: string;
  departureTime: string;
  arrivalTime: string;
  numStops: number;
}

interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  travelMode: string;
  transit?: TransitInfo;
}

interface TransitRoute {
  distance: string;
  duration: string;
  departureTime: string;
  arrivalTime: string;
  steps: DirectionStep[];
}

function vehicleLabel(type: string) {
  const map: Record<string, string> = {
    BUS: 'Otobüs', SUBWAY: 'Metro', METRO_RAIL: 'Metro', TRAM: 'Tramvay',
    LIGHT_RAIL: 'Tramvay', HEAVY_RAIL: 'Tren', FERRY: 'Vapur', FUNICULAR: 'Füniküler',
  };
  return map[type?.toUpperCase()] || 'Toplu Taşıma';
}

function getStepIcon(step: DirectionStep) {
  if (step.travelMode === 'walking') return <Footprints className="w-3.5 h-3.5 text-gray-400" />;
  const vt = step.transit?.vehicleType?.toUpperCase() || '';
  if (['SUBWAY', 'METRO_RAIL', 'HEAVY_RAIL', 'TRAM', 'LIGHT_RAIL', 'FUNICULAR'].includes(vt))
    return <TrainFront className="w-3.5 h-3.5 text-purple-600" />;
  return <Bus className="w-3.5 h-3.5 text-brand-soft-blue" />;
}

export default function TransitDirectionsWidget() {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [route, setRoute] = useState<TransitRoute | null>(null);
  const [loadingDir, setLoadingDir] = useState(false);
  const [dirError, setDirError] = useState('');

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('Konum desteklenmiyor.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocating(false); },
      () => { setLocError('Konum alınamadı.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Autocomplete
  useEffect(() => {
    if (query.length < 2) { setPredictions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(query)}`);
        const data = await res.json();
        setPredictions(data.predictions || []);
        setShowPredictions(true);
      } catch { setPredictions([]); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowPredictions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Select place
  const handleSelect = async (p: Prediction) => {
    setShowPredictions(false);
    setQuery(p.structured_formatting?.main_text || p.description);
    setLoadingPlace(true);
    setSelectedPlace(null);
    setRoute(null);
    setDirError('');
    try {
      const res = await fetch(`/api/maps/details?place_id=${encodeURIComponent(p.place_id)}`);
      const data = await res.json();
      if (data.lat && data.lng) {
        setSelectedPlace({ name: data.name || p.description, lat: data.lat, lng: data.lng });
      } else { setDirError('Koordinat alınamadı.'); }
    } catch { setDirError('Yer bilgisi alınamadı.'); }
    finally { setLoadingPlace(false); }
  };

  // Fetch directions
  useEffect(() => {
    if (!selectedPlace || userLat == null || userLng == null) return;
    const go = async () => {
      setLoadingDir(true); setDirError(''); setRoute(null);
      try {
        const res = await fetch(`/api/maps/directions?origin=${userLat},${userLng}&destination=${selectedPlace.lat},${selectedPlace.lng}&mode=transit`);
        const data = await res.json();
        if (data.routes?.length) { setRoute(data.routes[0]); }
        else if (data.status === 'ZERO_RESULTS') { setDirError('Toplu taşıma rotası bulunamadı.'); }
        else { setDirError('Rota bulunamadı.'); }
      } catch { setDirError('Hata oluştu.'); }
      finally { setLoadingDir(false); }
    };
    go();
  }, [selectedPlace, userLat, userLng]);

  const handleClear = () => { setQuery(''); setSelectedPlace(null); setRoute(null); setDirError(''); setPredictions([]); };
  const loading = locating || loadingPlace || loadingDir;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-brand-orange" />
          <h2 className="font-bold text-sm text-gray-900">Yol Tarifi</h2>
        </div>
        <Link href="/yol-tarifi" className="text-xs text-brand-soft-blue hover:underline">
          Detaylı arama →
        </Link>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Nereye gitmek istiyorsunuz?"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedPlace(null); setRoute(null); setDirError(''); }}
          onFocus={() => predictions.length > 0 && setShowPredictions(true)}
          className="w-full pl-10 pr-9 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
        {showPredictions && predictions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {predictions.slice(0, 5).map((p) => (
              <button
                key={p.place_id}
                onClick={() => handleSelect(p)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 border-b last:border-b-0"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-none" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{p.structured_formatting?.main_text || p.description}</div>
                  {p.structured_formatting?.secondary_text && (
                    <div className="text-xs text-gray-500 truncate">{p.structured_formatting.secondary_text}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{locating ? 'Konum alınıyor…' : loadingPlace ? 'Yer bilgisi…' : 'Rota hesaplanıyor…'}</span>
        </div>
      )}

      {/* Error */}
      {dirError && !loading && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          <span>{dirError}</span>
        </div>
      )}

      {locError && !loading && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          <span>{locError}</span>
          <button onClick={requestLocation} className="ml-auto underline text-[11px]">Tekrar dene</button>
        </div>
      )}

      {/* Route result */}
      {route && !loading && (
        <div>
          {/* Summary */}
          <div className="flex items-center gap-3 bg-brand-light-blue/30 rounded-xl px-3 py-2.5 mb-3">
            <Clock className="w-4 h-4 text-brand-soft-blue flex-none" />
            <span className="font-bold text-sm text-brand-soft-blue">{route.duration}</span>
            <span className="text-xs text-gray-500">{route.distance}</span>
            {route.departureTime && (
              <span className="text-xs text-gray-400 ml-auto">{route.departureTime} → {route.arrivalTime}</span>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-0">
            {route.steps.map((step, i) => (
              <div key={i} className="relative">
                {i < route.steps.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-200" />
                )}
                <div className="flex gap-2.5 pb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-none z-10"
                    style={step.transit?.color ? {
                      backgroundColor: step.transit.color,
                      color: step.transit.textColor || '#fff',
                    } : {
                      backgroundColor: step.travelMode === 'walking' ? '#f3f4f6' : '#e0e7ff',
                    }}
                  >
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {step.travelMode === 'walking' ? (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Yürü</span>
                        {step.distance && <span className="text-gray-400"> — {step.distance}</span>}
                        {step.duration && <span className="text-gray-400"> ({step.duration})</span>}
                      </p>
                    ) : step.transit ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="px-1.5 py-0.5 rounded text-[11px] font-bold"
                            style={{ backgroundColor: step.transit.color || '#304269', color: step.transit.textColor || '#fff' }}
                          >
                            {step.transit.line}
                          </span>
                          <span className="text-[11px] text-gray-400">{vehicleLabel(step.transit.vehicleType)}</span>
                          {step.duration && <span className="text-[11px] text-gray-400 ml-auto">{step.duration}</span>}
                        </div>
                        <div className="text-xs text-gray-700 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-none" />
                            <span className="truncate">{step.transit.departureStop}</span>
                            {step.transit.departureTime && <span className="text-[11px] text-gray-400 ml-auto flex-none">{step.transit.departureTime}</span>}
                          </div>
                          {step.transit.numStops > 0 && (
                            <div className="flex items-center gap-1.5 pl-0.5">
                              <ArrowDown className="w-2.5 h-2.5 text-gray-300" />
                              <span className="text-[11px] text-gray-400">{step.transit.numStops} durak</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-none" />
                            <span className="truncate">{step.transit.arrivalStop}</span>
                            {step.transit.arrivalTime && <span className="text-[11px] text-gray-400 ml-auto flex-none">{step.transit.arrivalTime}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">{step.instruction}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Destination */}
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-none">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div className="flex items-center">
                <span className="text-xs font-medium text-gray-800 truncate">{selectedPlace?.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !dirError && !route && !selectedPlace && !locError && (
        <p className="text-center text-xs text-gray-400 py-4">
          Gitmek istediğiniz yeri yazın, toplu taşıma rotanızı görelim.
        </p>
      )}
    </div>
  );
}
