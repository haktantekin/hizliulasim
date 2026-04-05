'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Loader2, MapPin, Navigation, Clock,
  Footprints, Bus, TrainFront, ArrowDown, LocateFixed, X, AlertCircle, ArrowRightLeft,
} from 'lucide-react';
import Link from 'next/link';

/* ---------- types ---------- */
interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface TransitInfo {
  line: string;
  lineName: string;
  vehicleType: string;
  vehicleIcon: string;
  color: string;
  textColor: string;
  departureStop: string;
  arrivalStop: string;
  departureTime: string;
  arrivalTime: string;
  numStops: number;
  agencyName: string;
}

interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver: string;
  travelMode: string;
  transit?: TransitInfo;
}

interface TransitRoute {
  summary: string;
  distance: string;
  duration: string;
  departureTime: string;
  arrivalTime: string;
  startAddress: string;
  endAddress: string;
  steps: DirectionStep[];
}

/* ---------- helpers ---------- */
function getStepIcon(step: DirectionStep) {
  if (step.travelMode === 'walking') return <Footprints className="w-4 h-4 text-gray-500" />;
  const vt = step.transit?.vehicleType?.toUpperCase() || '';
  if (['SUBWAY', 'METRO_RAIL', 'HEAVY_RAIL', 'RAIL', 'TRAM', 'LIGHT_RAIL', 'MONORAIL', 'CABLE_CAR', 'FUNICULAR'].includes(vt)) {
    return <TrainFront className="w-4 h-4 text-purple-600" />;
  }
  return <Bus className="w-4 h-4 text-brand-soft-blue" />;
}

function vehicleLabel(type: string) {
  const map: Record<string, string> = {
    BUS: 'Otobüs',
    SUBWAY: 'Metro',
    METRO_RAIL: 'Metro',
    HEAVY_RAIL: 'Tren',
    RAIL: 'Tren',
    TRAM: 'Tramvay',
    LIGHT_RAIL: 'Tramvay',
    MONORAIL: 'Monoray',
    CABLE_CAR: 'Teleferik',
    FUNICULAR: 'Füniküler',
    FERRY: 'Vapur',
    TROLLEYBUS: 'Troleybüs',
  };
  return map[type?.toUpperCase()] || 'Toplu Taşıma';
}

/* ---------- component ---------- */
export default function TransitDirectionsClient() {
  // Location
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  // Search
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Directions
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [loadingDir, setLoadingDir] = useState(false);
  const [dirError, setDirError] = useState('');

  /* --- get location --- */
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('Tarayıcınız konum özelliğini desteklemiyor.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocError('Konum alınamadı. Lütfen konum iznini kontrol edin.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  /* --- autocomplete --- */
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

  /* --- close dropdown on outside click --- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* --- select place --- */
  const handleSelect = async (p: Prediction) => {
    setShowPredictions(false);
    setQuery(p.description);
    setLoadingPlace(true);
    setSelectedPlace(null);
    setRoutes([]);
    setDirError('');

    try {
      const res = await fetch(`/api/maps/details?place_id=${encodeURIComponent(p.place_id)}`);
      const data = await res.json();
      if (data.lat && data.lng) {
        setSelectedPlace({ name: data.name || p.description, lat: data.lat, lng: data.lng });
      } else {
        setDirError('Seçilen yerin koordinatları alınamadı.');
      }
    } catch {
      setDirError('Yer bilgisi alınırken hata oluştu.');
    } finally {
      setLoadingPlace(false);
    }
  };

  /* --- fetch directions when place selected + location available --- */
  useEffect(() => {
    if (!selectedPlace || userLat == null || userLng == null) return;

    const fetchDirections = async () => {
      setLoadingDir(true);
      setDirError('');
      setRoutes([]);
      setActiveRoute(0);

      try {
        const origin = `${userLat},${userLng}`;
        const dest = `${selectedPlace.lat},${selectedPlace.lng}`;
        const res = await fetch(`/api/maps/directions?origin=${origin}&destination=${dest}&mode=transit`);
        const data = await res.json();

        if (data.status === 'ZERO_RESULTS') {
          setDirError('Bu güzergâh için toplu taşıma rotası bulunamadı.');
        } else if (data.routes?.length) {
          setRoutes(data.routes);
        } else {
          setDirError('Rota bulunamadı. Lütfen farklı bir hedef deneyin.');
        }
      } catch {
        setDirError('Yol tarifi alınırken hata oluştu.');
      } finally {
        setLoadingDir(false);
      }
    };

    fetchDirections();
  }, [selectedPlace, userLat, userLng]);

  /* --- clear --- */
  const handleClear = () => {
    setQuery('');
    setSelectedPlace(null);
    setRoutes([]);
    setDirError('');
    setPredictions([]);
  };

  const loading = locating || loadingPlace || loadingDir;
  const currentRoute = routes[activeRoute];

  return (
    <div>
      {/* Location status */}
      {locError && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-none" />
          <span>{locError}</span>
          <button onClick={requestLocation} className="ml-auto text-amber-800 underline text-xs">Tekrar dene</button>
        </div>
      )}

      {userLat != null && !locError && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-green-600">
          <LocateFixed className="w-3.5 h-3.5" />
          <span>Konumunuz alındı</span>
        </div>
      )}

      {/* Search input */}
      <div ref={searchRef} className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Nereye gitmek istiyorsunuz? (örn. Ayasofya, Taksim Meydanı…)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedPlace(null); setRoutes([]); setDirError(''); }}
          onFocus={() => predictions.length > 0 && setShowPredictions(true)}
          className="w-full pl-10 pr-9 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Predictions dropdown */}
        {showPredictions && predictions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                onClick={() => handleSelect(p)}
                className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-none" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {p.structured_formatting?.main_text || p.description}
                  </div>
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
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{locating ? 'Konum alınıyor…' : loadingPlace ? 'Yer bilgisi alınıyor…' : 'Rota hesaplanıyor…'}</span>
        </div>
      )}

      {/* Error */}
      {dirError && !loading && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-none" />
          <span>{dirError}</span>
        </div>
      )}

      {/* Route tabs */}
      {routes.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {routes.map((r, i) => (
            <button
              key={i}
              onClick={() => setActiveRoute(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeRoute
                  ? 'bg-brand-soft-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3" />
              Rota {i + 1} — {r.duration}
            </button>
          ))}
        </div>
      )}

      {/* Route details */}
      {currentRoute && !loading && (
        <div>
          {/* Summary card */}
          <div className="bg-brand-light-blue/30 border border-brand-soft-blue/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-soft-blue" />
                <span className="font-bold text-brand-soft-blue">{currentRoute.duration}</span>
              </div>
              <span className="text-xs text-gray-500">{currentRoute.distance}</span>
            </div>
            {(currentRoute.departureTime || currentRoute.arrivalTime) && (
              <div className="text-xs text-gray-600">
                {currentRoute.departureTime && <span>Kalkış: {currentRoute.departureTime}</span>}
                {currentRoute.departureTime && currentRoute.arrivalTime && <span className="mx-2">→</span>}
                {currentRoute.arrivalTime && <span>Varış: {currentRoute.arrivalTime}</span>}
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-0">
            {currentRoute.steps.map((step, i) => (
              <div key={i} className="relative">
                {/* Connector line */}
                {i < currentRoute.steps.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200" />
                )}

                <div className="flex gap-3 pb-4">
                  {/* Icon circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-none z-10"
                    style={step.transit?.color ? {
                      backgroundColor: step.transit.color,
                      color: step.transit.textColor || '#fff',
                    } : {
                      backgroundColor: step.travelMode === 'walking' ? '#f3f4f6' : '#e0e7ff',
                    }}
                  >
                    {getStepIcon(step)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {step.travelMode === 'walking' ? (
                      /* Walking step */
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">Yürü</span>
                          {step.distance && <span className="text-gray-500"> — {step.distance}</span>}
                          {step.duration && <span className="text-gray-500"> ({step.duration})</span>}
                        </div>
                        {step.instruction && (
                          <p className="text-xs text-gray-500 mt-1">{step.instruction}</p>
                        )}
                      </div>
                    ) : step.transit ? (
                      /* Transit step */
                      <div className="bg-white border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-bold"
                            style={{
                              backgroundColor: step.transit.color || '#304269',
                              color: step.transit.textColor || '#fff',
                            }}
                          >
                            {step.transit.line}
                          </span>
                          <span className="text-xs text-gray-500">
                            {vehicleLabel(step.transit.vehicleType)}
                          </span>
                          {step.duration && (
                            <span className="text-xs text-gray-400 ml-auto">{step.duration}</span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 flex-none" />
                            <span className="text-gray-800">{step.transit.departureStop}</span>
                            {step.transit.departureTime && (
                              <span className="text-xs text-gray-400 ml-auto">{step.transit.departureTime}</span>
                            )}
                          </div>

                          {step.transit.numStops > 0 && (
                            <div className="flex items-center gap-2 pl-1">
                              <ArrowDown className="w-3 h-3 text-gray-300" />
                              <span className="text-xs text-gray-400">{step.transit.numStops} durak</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-none" />
                            <span className="text-gray-800">{step.transit.arrivalStop}</span>
                            {step.transit.arrivalTime && (
                              <span className="text-xs text-gray-400 ml-auto">{step.transit.arrivalTime}</span>
                            )}
                          </div>
                        </div>

                        {/* Link to bus line */}
                        {step.transit.vehicleType?.toUpperCase() === 'BUS' && step.transit.line && (
                          <Link
                            href={`/otobus-hatlari/${step.transit.line}`}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-brand-soft-blue hover:underline"
                          >
                            <Navigation className="w-3 h-3" />
                            {step.transit.line} hat detayı
                          </Link>
                        )}
                      </div>
                    ) : (
                      /* Fallback */
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-sm text-gray-700">{step.instruction}</p>
                        {step.distance && <p className="text-xs text-gray-500 mt-1">{step.distance} — {step.duration}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Destination marker */}
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-none">
                <MapPin className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0 flex items-center">
                <span className="text-sm font-medium text-gray-800">
                  {selectedPlace?.name || 'Hedefe vardınız'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !dirError && routes.length === 0 && !selectedPlace && userLat != null && (
        <div className="text-center py-10 text-gray-400 text-sm">
          Gitmek istediğiniz yeri yukarıdan arayın.
        </div>
      )}
    </div>
  );
}
