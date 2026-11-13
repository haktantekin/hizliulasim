'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { IETTDurakDetay } from '@/types/iett';
import type { UserLocation } from './BusRouteDetailClient';
import { ArrowRightLeft, MapPin, Navigation } from 'lucide-react';
import { findNearestStop } from './nearest-stop';

const NearestStopMap = dynamic(() => import('./NearestStopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[250px] md:h-[300px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  duraklar: IETTDurakDetay[];
  userLocation: UserLocation;
}

const DIRECTION_LABELS: Record<string, string> = {
  D: 'Gidiş',
  G: 'Dönüş',
};

function formatDistance(meters: number): string {
  if (meters < 50) return 'Çok yakın';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function walkingTime(meters: number): string {
  const minutes = Math.round(meters / 83);
  if (minutes < 1) return '1 dk\'dan az';
  return `~${minutes} dk yürüme`;
}

export default function NearestStopAssistant({ duraklar, userLocation }: Props) {
  const [requestedDirection, setRequestedDirection] = useState<string>('D');

  const directions = useMemo(() => {
    const directionMap = new Map<string, string>();
    for (const stop of duraklar) {
      if (!directionMap.has(stop.YON)) directionMap.set(stop.YON, stop.YON_ADI);
    }
    return Array.from(directionMap.entries()).map(([yon, yonAdi]) => ({ yon, yonAdi }));
  }, [duraklar]);

  const selectedDirection = directions.some(({ yon }) => yon === requestedDirection)
    ? requestedDirection
    : directions[0]?.yon ?? 'D';

  const nearestStop = useMemo(() => {
    if (userLocation.status !== 'active') return null;
    return findNearestStop(duraklar, selectedDirection, userLocation);
  }, [duraklar, selectedDirection, userLocation]);

  if (userLocation.status !== 'active') return null;

  const routeStops = duraklar.filter((stop) => stop.YON === selectedDirection);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Navigation className="w-4 h-4 text-brand-soft-blue" />
          Yakınımdaki Durak
        </h3>

        {directions.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <ArrowRightLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500">Yön:</span>
            {directions.map(({ yon, yonAdi }) => (
              <button
                key={yon}
                onClick={() => setRequestedDirection(yon)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedDirection === yon
                    ? 'bg-brand-soft-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {DIRECTION_LABELS[yon] || yon}{yonAdi ? ` — ${yonAdi}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {nearestStop && (
        <NearestStopMap
          userLat={userLocation.lat}
          userLng={userLocation.lng}
          stop={nearestStop.stop}
          selectedVehicle={null}
          otherVehicles={[]}
          routeStops={routeStops}
          allDuraklar={duraklar}
        />
      )}

      <div className="p-4">
        {nearestStop ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">En Yakın Durak</div>
              <div className="font-medium text-sm text-gray-900 truncate">{nearestStop.stop.DURAKADI}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                <span className="font-mono">{nearestStop.stop.DURAKKODU}</span>
                <span>•</span>
                <span>{formatDistance(nearestStop.distance)}</span>
                <span>•</span>
                <span>{walkingTime(nearestStop.distance)}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Yön: {nearestStop.stop.YON_ADI} ({nearestStop.stop.SIRANO}. durak)
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2">
            Bu hat için geçerli durak koordinatı bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
