'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, MapPin, Clock, Footprints, Bus, TrainFront, ArrowDown, AlertCircle, Navigation,
} from 'lucide-react';
import Link from 'next/link';

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

const STRIP_SUFFIXES = [
  'nasıl gidilir', 'yol tarifi', 'nerede', 'nerededir',
  'ulaşım', 'ulaşım rehberi', 'otobüs', 'metro', 'tramvay',
  'how to get', 'directions',
];

function extractPlaceName(title: string): string {
  let name = title.trim();
  // Remove common suffixes (case-insensitive)
  for (const suffix of STRIP_SUFFIXES) {
    const re = new RegExp(`\\s*[-–—|:]?\\s*${suffix}\\s*$`, 'i');
    name = name.replace(re, '');
  }
  // Also remove trailing punctuation
  name = name.replace(/[\s\-–—|:?!]+$/, '').trim();
  return name || title.trim();
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

export default function PostTransitWidget({ postTitle }: { postTitle: string }) {
  const [activated, setActivated] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const [destName, setDestName] = useState('');
  const [route, setRoute] = useState<TransitRoute | null>(null);
  const [loadingDir, setLoadingDir] = useState(false);
  const [dirError, setDirError] = useState('');

  const placeName = extractPlaceName(postTitle);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('Konum desteklenmiyor.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocating(false); },
      () => { setLocError('Konum izni verilmedi.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleActivate = () => {
    setActivated(true);
    requestLocation();
  };

  // Fetch directions only after user clicks the button and location is available
  useEffect(() => {
    if (!activated || userLat == null || userLng == null || !placeName) return;

    const go = async () => {
      setLoadingDir(true);
      setDirError('');
      setRoute(null);
      setDestName('');

      try {
        const acRes = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(placeName + ' İstanbul')}`);
        const acData = await acRes.json();
        const prediction = acData.predictions?.[0];
        if (!prediction) {
          setDirError('Yer bulunamadı.');
          setLoadingDir(false);
          return;
        }

        const dtRes = await fetch(`/api/maps/details?place_id=${encodeURIComponent(prediction.place_id)}`);
        const dtData = await dtRes.json();
        if (!dtData.lat || !dtData.lng) {
          setDirError('Koordinat alınamadı.');
          setLoadingDir(false);
          return;
        }
        setDestName(dtData.name || prediction.structured_formatting?.main_text || placeName);

        const dirRes = await fetch(`/api/maps/directions?origin=${userLat},${userLng}&destination=${dtData.lat},${dtData.lng}&mode=transit`);
        const dirData = await dirRes.json();

        if (dirData.routes?.length) {
          setRoute(dirData.routes[0]);
        } else if (dirData.status === 'ZERO_RESULTS') {
          setDirError('Toplu taşıma rotası bulunamadı.');
        } else {
          setDirError('Rota bulunamadı.');
        }
      } catch {
        setDirError('Yol tarifi alınamadı.');
      } finally {
        setLoadingDir(false);
      }
    };

    go();
  }, [activated, userLat, userLng, placeName]);

  const loading = locating || loadingDir;

  // Initial state: show CTA button
  if (!activated) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center flex-none">
            <Navigation className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{placeName}</p>
            <p className="text-xs text-gray-500">Toplu taşıma ile nasıl gidilir?</p>
          </div>
          <button
            onClick={handleActivate}
            className="px-4 py-2 bg-brand-orange text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors flex-none"
          >
            Yol Tarifi Al
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="w-5 h-5 text-brand-orange" />
        <h3 className="font-bold text-sm text-gray-900">
          {destName || placeName} — Yol Tarifi
        </h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4 text-gray-400 text-xs justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{locating ? 'Konumunuz alınıyor…' : 'Rota hesaplanıyor…'}</span>
        </div>
      )}

      {/* Location error */}
      {locError && !loading && (
        <div className="flex items-center gap-2 p-3 bg-amber-100/60 rounded-xl text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          <span>{locError}</span>
          <button onClick={requestLocation} className="ml-auto underline text-[11px]">Tekrar dene</button>
        </div>
      )}

      {/* Direction error */}
      {dirError && !loading && !locError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          <span>{dirError}</span>
        </div>
      )}

      {/* Route result */}
      {route && !loading && (
        <div>
          {/* Summary */}
          <div className="flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2 mb-3">
            <Clock className="w-4 h-4 text-brand-soft-blue flex-none" />
            <span className="font-bold text-sm text-brand-soft-blue">{route.duration}</span>
            <span className="text-xs text-gray-500">{route.distance}</span>
            {route.departureTime && (
              <span className="text-[11px] text-gray-400 ml-auto">{route.departureTime} → {route.arrivalTime}</span>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-0">
            {route.steps.map((step, i) => (
              <div key={i} className="relative">
                {i < route.steps.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-orange-200" />
                )}
                <div className="flex gap-2.5 pb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-none z-10"
                    style={step.transit?.color ? {
                      backgroundColor: step.transit.color,
                      color: step.transit.textColor || '#fff',
                    } : {
                      backgroundColor: step.travelMode === 'walking' ? '#fff4e6' : '#e0e7ff',
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
                <span className="text-xs font-medium text-gray-800 truncate">{destName || placeName}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center">
            <Link href="/yol-tarifi" className="text-xs text-brand-soft-blue hover:underline">
              Farklı bir yer için yol tarifi al →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
